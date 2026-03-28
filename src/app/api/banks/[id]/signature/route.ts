import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { hasAWSConfig, putBankSignature, deleteBankSignature } from "@/lib/signatureStorage";
import sharp from "sharp";

// Force Node.js runtime for file processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Signature normalization constants
const SIGNATURE_TARGET_WIDTH = 600;
const SIGNATURE_TARGET_HEIGHT = 200;

/**
 * POST /api/banks/:id/signature
 * Upload signature image for a bank (PNG or JPEG only)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log('[BANK SIGNATURE] POST endpoint hit');
  
  try {
    // Auth required
    const authResult = await requireAuth(req);
    const userId = authResult.userId;
    
    const { id: bankIdStr } = await context.params;
    const bankId = parseInt(bankIdStr, 10);
    
    console.log(`[BANK SIGNATURE] POST processing bank ID: ${bankId}`);
    
    if (isNaN(bankId)) {
      return NextResponse.json(
        { error: "Invalid bank ID" },
        { status: 400 }
      );
    }

    // Verify bank exists
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, signature_url: true },
    });

    if (!bank) {
      return NextResponse.json(
        { error: "Bank not found" },
        { status: 404 }
      );
    }

    // Check authorization (only SUPER_ADMIN can manage signatures)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can manage bank signatures" },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("signature") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (PNG or JPEG only - TIFF not supported)
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().match(/\.(jpg|jpeg)$/i);

    if (!isPng && !isJpeg) {
      return NextResponse.json(
        { error: "Only PNG and JPEG files are accepted" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Convert File to Buffer and detect actual format from magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Detect actual file format from magic bytes (first few bytes)
    let actualFormat: 'png' | 'jpg' = 'jpg'; // default
    if (buffer.length >= 8) {
      const header = buffer.subarray(0, 8);
      
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        actualFormat = 'png';
      }
      // JPEG: FF D8 FF
      else if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        actualFormat = 'jpg';
      }
      // TIFF detected - reject it
      else if (
        (header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2A && header[3] === 0x00) ||
        (header[0] === 0x4D && header[1] === 0x4D && header[2] === 0x00 && header[3] === 0x2A)
      ) {
        return NextResponse.json(
          { error: "TIFF format is not supported. Please upload PNG or JPEG." },
          { status: 400 }
        );
      }
    }
    
    console.log(`[Signature Upload] Detected format: ${actualFormat} (claimed: ${file.type})`);

    // =========================================================================
    // SIGNATURE NORMALIZATION
    // =========================================================================
    // Process signature to ensure consistent size and remove excess whitespace
    // This runs ONCE at upload time to make PDF rendering predictable forever
    
    console.log('[Signature Normalize] Starting normalization...');
    console.log(`[Signature Normalize] Original size: ${buffer.length} bytes`);
    
    let processedBuffer: Buffer;
    
    try {
      processedBuffer = await sharp(buffer)
        // Trim transparent/white margins
        .trim({
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent or white
          threshold: 10, // Allow slight color variation
        })
        // Resize to fixed bounding box (600x200)
        .resize(SIGNATURE_TARGET_WIDTH, SIGNATURE_TARGET_HEIGHT, {
          fit: 'contain', // Maintain aspect ratio, fit within bounds
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        // Output as PNG (always, for transparency support)
        .png({
          compressionLevel: 9, // Maximum compression
          adaptiveFiltering: true,
        })
        .toBuffer();
      
      console.log(`[Signature Normalize] Processed size: ${processedBuffer.length} bytes`);
      console.log(`[Signature Normalize] Target dimensions: ${SIGNATURE_TARGET_WIDTH}x${SIGNATURE_TARGET_HEIGHT}px`);
      
      // Get metadata to confirm final dimensions
      const metadata = await sharp(processedBuffer).metadata();
      console.log(`[Signature Normalize] Final dimensions: ${metadata.width}x${metadata.height}px`);
      
    } catch (error) {
      console.error('[Signature Normalize] Failed to process image:', error);
      return NextResponse.json(
        { error: "Failed to process signature image. Please ensure it's a valid PNG or JPEG." },
        { status: 400 }
      );
    }
    
    // =========================================================================
    // END SIGNATURE NORMALIZATION
    // =========================================================================

    // Upload to new S3 bucket (always PNG after normalization)
    const extension = 'png'; // Always PNG after processing
    
    if (!hasAWSConfig) {
      return NextResponse.json(
        { error: "AWS S3 storage is not configured" },
        { status: 500 }
      );
    }

    const { key } = await putBankSignature({
      bankId,
      fileBytes: processedBuffer, // Use normalized image
      contentType: 'image/png', // Always PNG after normalization
      extension,
    });

    // Store S3 key in database
    await prisma.bank.update({
      where: { id: bankId },
      data: { signature_url: key },
    });

    // Fetch the updated bank to confirm write
    const updatedBank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { 
        id: true,
        signature_url: true,
        created_at: true,
      }
    });

    console.log('[SIG UPLOAD] Bank updated in DB:', {
      bankId,
      newKey: key,
      dbValue: updatedBank?.signature_url,
      match: updatedBank?.signature_url === key,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Signature Upload] Bank ${bankId}: ${key}`);

    return NextResponse.json({
      success: true,
      signatureKey: key,
      message: "Signature uploaded successfully",
    });

  } catch (error) {
    console.error("Signature upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload signature" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/banks/:id/signature
 * Remove signature for a bank
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log('[BANK SIGNATURE] DELETE endpoint hit');
  
  try {
    // Auth required
    const authResult = await requireAuth(req);
    const userId = authResult.userId;
    
    const { id: bankIdStr } = await context.params;
    const bankId = parseInt(bankIdStr, 10);
    
    console.log(`[BANK SIGNATURE] DELETE processing bank ID: ${bankId}`);
    
    if (isNaN(bankId)) {
      return NextResponse.json(
        { error: "Invalid bank ID" },
        { status: 400 }
      );
    }

    // Verify bank exists
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, signature_url: true },
    });

    if (!bank) {
      return NextResponse.json(
        { error: "Bank not found" },
        { status: 404 }
      );
    }

    // Check authorization (only SUPER_ADMIN can manage signatures)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can manage bank signatures" },
        { status: 403 }
      );
    }

    // Delete signature from S3
    if (bank.signature_url) {
      try {
        // Check if it's an S3 key (starts with "signatures/")
        if (bank.signature_url.startsWith('signatures/')) {
          await deleteBankSignature(bank.signature_url);
          console.log(`[Signature Delete] Removed from S3: ${bank.signature_url}`);
        } else {
          // Legacy path - log only, don't fail
          console.warn(`[Signature Delete] Legacy path detected (ignoring): ${bank.signature_url}`);
        }
      } catch (err) {
        console.warn(`[Signature Delete] Failed to delete from S3:`, err);
        // Continue anyway - delete from DB
      }
    }

    // Clear signature_url in database
    await prisma.bank.update({
      where: { id: bankId },
      data: { signature_url: null },
    });

    return NextResponse.json({
      success: true,
      message: "Signature removed successfully",
    });

  } catch (error) {
    console.error("Signature delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove signature" },
      { status: 500 }
    );
  }
}
