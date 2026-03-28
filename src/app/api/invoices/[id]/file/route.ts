import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonGuardError } from '@/lib/guards';
import { hasAWSConfig, getPresignedSignatureUrl } from '@/lib/signatureStorage';
import { hasS3Config, getS3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req);

    const { id } = await context.params;
    const checkId = parseInt(id, 10);
    if (isNaN(checkId) || checkId <= 0) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const check = await prisma.check.findUnique({
      where: { id: checkId },
      select: { invoice_url: true },
    });

    if (!check?.invoice_url) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const storedUrl = check.invoice_url;

    // S3 key stored as a relative path (e.g. "invoices/2026/02/filename.pdf")
    // Generate a short-lived presigned URL so the browser can access the private object
    if (!storedUrl.startsWith('http')) {
      const keyRaw = storedUrl;
      const key = keyRaw.replace(/^\/+/, ''); // strip leading slashes to avoid //bucket double-slash
      console.log('[S3 KEY NORMALIZED]', { keyRaw, key });
      console.log('[PRESIGN KEY]', key);

      if (hasAWSConfig) {
        const presigned = await getPresignedSignatureUrl(key, 300); // 5 min
        return NextResponse.redirect(presigned);
      }
      if (hasS3Config) {
        const cmd = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET as string,
          Key: key,
        });
        const presigned = await getSignedUrl(getS3Client(), cmd, { expiresIn: 300 });
        return NextResponse.redirect(presigned);
      }
      return NextResponse.json(
        { error: 'Storage not configured — cannot resolve invoice URL' },
        { status: 503 }
      );
    }

    // Full URL (Supabase public URL, legacy S3 public URL, or local /uploads path)
    return NextResponse.redirect(storedUrl);
  } catch (error: any) {
    if (error?.status) return jsonGuardError(error);
    console.error('[GET /api/invoices/[id]/file] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve invoice' }, { status: 500 });
  }
}
