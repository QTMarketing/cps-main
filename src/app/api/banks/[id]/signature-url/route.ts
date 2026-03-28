import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMinimumRole } from '@/lib/rbac';
import { Role } from '@/lib/roles';
import { hasAWSConfig, getPresignedSignatureUrl } from '@/lib/signatureStorage';

/**
 * GET /api/banks/[id]/signature-url
 * Returns a presigned URL for browser access to the bank's signature image stored in S3
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    console.log("[ROUTE ENTRY] /api/banks/[id]/signature-url - raw params:", params);
    
    // Require authentication (minimum USER role)
    const authCheck = requireMinimumRole(Role.USER);
    const authResponse = await authCheck(req);
    if (authResponse) {
      return authResponse;
    }

    const { id } = await params;
    const bankId = parseInt(id, 10);

    if (isNaN(bankId)) {
      return NextResponse.json(
        { error: 'Invalid bank ID' },
        { status: 400 }
      );
    }

    // Fetch bank signature URL from database
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { signature_url: true },
    });

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    // If no signature, return null URL
    if (!bank.signature_url) {
      return NextResponse.json({
        ok: true,
        url: null,
      });
    }

    const signatureKey = bank.signature_url.trim();

    // If not an S3 key (legacy path), return null
    if (!signatureKey.startsWith('signatures/')) {
      console.warn(`[Signature URL API] Legacy path detected: ${signatureKey}`);
      return NextResponse.json({
        ok: true,
        url: null,
      });
    }

    // Check if S3 is configured
    if (!hasAWSConfig) {
      console.error('[Signature URL API] AWS S3 not configured - missing environment variables');
      console.error('[Signature URL API] Required: AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
      return NextResponse.json({
        ok: true,
        url: null,
      });
    }

    console.log(`[Signature URL API] Generating presigned URL for key: ${signatureKey}`);
    
    // Generate presigned URL (120 seconds expiry)
    try {
      const presignedUrl = await getPresignedSignatureUrl(signatureKey, 120);
      
      console.log(`[Signature URL API] Successfully generated presigned URL`);
      
      return NextResponse.json({
        ok: true,
        url: presignedUrl,
      });
    } catch (presignError) {
      console.error('[Signature URL API] Failed to generate presigned URL:', presignError);
      return NextResponse.json({
        ok: true,
        url: null,
      }, { status: 200 });
    }
  } catch (error) {
    console.error('[Signature URL API] Unexpected error:', error);
    return NextResponse.json(
      { 
        ok: false,
        error: 'Failed to get signature URL',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
