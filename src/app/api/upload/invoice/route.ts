import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { hasS3Config, putObject } from '@/lib/s3';
import { hasAWSConfig, putInvoice } from '@/lib/signatureStorage';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const checkNumber = String(formData.get('checkNumber') || 'unknown');
    
    if (!file) return NextResponse.json({ error: 'File missing' }, { status: 400 });

    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    
    // Use checkNumber in filename for better organization
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const ts = now.getTime();
    const filename = `${checkNumber}-${ts}.${ext}`;
    const key = `uploads/invoices/${yyyy}/${mm}/${filename}`;
    console.log('[INVOICE UPLOAD] key', key);

    // Prefer S3 when configured (Vercel/prod). Fallback to local for dev.
    if (hasS3Config) {
      try {
        // Prefer bucket policy over ACLs (handles buckets with ACLs disabled)
        const url = await putObject({ key, contentType: file.type, body: buffer });
        return NextResponse.json({ url });
      } catch (err: any) {
        console.error('[INVOICE UPLOAD ERROR] S3 (S3_* vars) upload failed:', {
          name: err?.name,
          message: err?.message,
          code: err?.Code || err?.code,
          statusCode: err?.$metadata?.httpStatusCode,
          requestId: err?.$metadata?.requestId,
        });
        return NextResponse.json({ error: 'S3 upload failed', details: err?.message || String(err) }, { status: 500 });
      }
    }

    // Fallback: use signature S3 credentials (AWS_* vars) when S3_* vars are not set
    if (hasAWSConfig) {
      try {
        const { key: s3Key } = await putInvoice({ key, fileBytes: buffer, contentType: file.type });
        // Return the key (not a full URL) — the /api/invoices/[id]/file endpoint generates presigned URLs
        console.log('[DB STORED KEY]', s3Key);
        return NextResponse.json({ url: s3Key });
      } catch (err: any) {
        console.error('[INVOICE UPLOAD ERROR] AWS (AWS_* vars) upload failed:', {
          name: err?.name,
          message: err?.message,
          code: err?.Code || err?.code,
          statusCode: err?.$metadata?.httpStatusCode,
          requestId: err?.$metadata?.requestId,
          bucket: process.env.AWS_S3_BUCKET,
          key,
        });
        return NextResponse.json({ error: 'S3 upload failed', details: err?.message || String(err) }, { status: 500 });
      }
    }

    // Local filesystem fallback (development only)
    // Use /tmp in serverless environments (Vercel, Lambda) where filesystem is read-only
    const baseDir = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? '/tmp/uploads/invoices'
      : path.join(process.cwd(), 'public', 'uploads', 'invoices');
    const uploadsDir = path.join(baseDir, yyyy, mm);
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);
    const publicUrl = `/uploads/invoices/${yyyy}/${mm}/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: 'Upload failed', details: e?.message || String(e) }, { status: 500 });
  }
}


