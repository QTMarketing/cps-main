import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { putBankSignature } from "@/lib/signatureStorage";
import sharp from "sharp";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Signature normalization constants
const SIGNATURE_TARGET_WIDTH = 600;
const SIGNATURE_TARGET_HEIGHT = 200;

/**
 * GET /api/admin/signatures/legacy
 * List all banks with legacy signature URLs
 * 
 * SUPER_ADMIN only
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check: SUPER_ADMIN only
    const ctx = await requireAuth(req);
    if (ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const legacyBanks = await prisma.bank.findMany({
      where: {
        signature_url: {
          startsWith: '/uploads/signatures/',
        },
      },
      select: {
        id: true,
        bank_name: true,
        signature_url: true,
        created_at: true,
        Store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      count: legacyBanks.length,
      banks: legacyBanks.map(bank => ({
        id: bank.id,
        bankName: bank.bank_name,
        signatureUrl: bank.signature_url,
        storeName: bank.Store?.name || null,
        createdAt: bank.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Legacy Signatures] GET error:', error);
    
    if ((error as any)?.status === 403 || (error as any)?.status === 401) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: (error as any).status }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch legacy signatures' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/signatures/legacy
 * Migrate a single bank's legacy signature to S3
 * 
 * Body: { bankId: number, action?: "migrate" | "clear" }
 * 
 * Actions:
 * - "migrate" (default): Attempt to fetch legacy file and upload to S3
 * - "clear": Set signature_url to null (requires manual reupload)
 * 
 * SUPER_ADMIN only
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check: SUPER_ADMIN only
    const ctx = await requireAuth(req);
    if (ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { bankId, action = 'migrate' } = body;

    if (!bankId || typeof bankId !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'bankId (number) is required' },
        { status: 400 }
      );
    }

    // Fetch bank
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: {
        id: true,
        bank_name: true,
        signature_url: true,
      },
    });

    if (!bank) {
      return NextResponse.json(
        { ok: false, error: 'Bank not found' },
        { status: 404 }
      );
    }

    if (!bank.signature_url || !bank.signature_url.startsWith('/uploads/signatures/')) {
      return NextResponse.json(
        { ok: false, error: 'Bank does not have a legacy signature URL' },
        { status: 400 }
      );
    }

    // Action: Clear signature
    if (action === 'clear') {
      await prisma.bank.update({
        where: { id: bankId },
        data: { signature_url: null },
      });

      console.log(`[Legacy Signatures] Cleared signature for bank ${bankId}`);
      
      return NextResponse.json({
        ok: true,
        action: 'cleared',
        message: 'Signature URL cleared. Bank can now upload a new signature.',
      });
    }

    // Action: Migrate signature
    if (action !== 'migrate') {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Must be "migrate" or "clear"' },
        { status: 400 }
      );
    }

    // Check if LEGACY_BASE_URL is configured
    const legacyBaseUrl = process.env.LEGACY_BASE_URL;
    if (!legacyBaseUrl) {
      return NextResponse.json({
        ok: false,
        error: 'LEGACY_BASE_URL environment variable is not configured',
        hint: 'Set LEGACY_BASE_URL to the base URL where legacy files are hosted (e.g., https://old-domain.com)',
        suggestion: 'Use action: "clear" to remove signature and require manual reupload',
      }, { status: 400 });
    }

    // Construct full legacy URL
    const legacyPath = bank.signature_url;
    const legacyUrl = `${legacyBaseUrl}${legacyPath}`;

    console.log(`[Legacy Signatures] Attempting to fetch: ${legacyUrl}`);

    // Attempt to fetch legacy file
    let fileBuffer: Buffer;
    let contentType: string;

    try {
      const response = await fetch(legacyUrl);
      
      if (!response.ok) {
        console.warn(`[Legacy Signatures] Legacy file not accessible: ${response.status}`);
        return NextResponse.json({
          ok: false,
          error: 'Legacy file not reachable',
          statusCode: response.status,
          legacyUrl,
          suggestion: 'File may have been deleted. Use action: "clear" and reupload via UI.',
        }, { status: 404 });
      }

      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get('content-type') || 'image/jpeg';
      
      console.log(`[Legacy Signatures] Fetched ${fileBuffer.length} bytes, type: ${contentType}`);
    } catch (fetchError) {
      console.error('[Legacy Signatures] Fetch failed:', fetchError);
      return NextResponse.json({
        ok: false,
        error: 'Failed to fetch legacy file',
        details: (fetchError as Error).message,
        legacyUrl,
      }, { status: 500 });
    }

    // Normalize signature using sharp (same as upload route)
    console.log('[Legacy Signatures] Normalizing signature...');
    
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(fileBuffer)
        .trim({
          background: { r: 255, g: 255, b: 255, alpha: 0 },
          threshold: 10,
        })
        .resize(SIGNATURE_TARGET_WIDTH, SIGNATURE_TARGET_HEIGHT, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toBuffer();
      
      console.log(`[Legacy Signatures] Normalized: ${processedBuffer.length} bytes`);
    } catch (sharpError) {
      console.error('[Legacy Signatures] Image processing failed:', sharpError);
      return NextResponse.json({
        ok: false,
        error: 'Failed to process legacy image',
        details: (sharpError as Error).message,
      }, { status: 500 });
    }

    // Upload to S3
    try {
      const { key } = await putBankSignature({
        bankId: bank.id,
        fileBytes: processedBuffer,
        contentType: 'image/png', // Always PNG after normalization
        extension: 'png',
      });

      console.log(`[Legacy Signatures] Uploaded to S3: ${key}`);

      // Update database
      await prisma.bank.update({
        where: { id: bankId },
        data: { signature_url: key },
      });

      console.log(`[Legacy Signatures] Updated bank ${bankId} signature_url to: ${key}`);

      return NextResponse.json({
        ok: true,
        action: 'migrated',
        bankId: bank.id,
        bankName: bank.bank_name,
        oldUrl: legacyPath,
        newUrl: key,
        message: 'Signature successfully migrated to S3',
      });
    } catch (s3Error) {
      console.error('[Legacy Signatures] S3 upload failed:', s3Error);
      return NextResponse.json({
        ok: false,
        error: 'Failed to upload to S3',
        details: (s3Error as Error).message,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Legacy Signatures] POST error:', error);
    
    if ((error as any)?.status === 403 || (error as any)?.status === 401) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: (error as any).status }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: 'Migration failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
