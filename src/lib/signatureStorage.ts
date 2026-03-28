import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY;

export const hasAWSConfig = Boolean(AWS_REGION && AWS_BUCKET && AWS_KEY_ID && AWS_SECRET);

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!hasAWSConfig) {
    throw new Error("Missing AWS S3 configuration. Required: AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_KEY_ID as string,
        secretAccessKey: AWS_SECRET as string,
      },
    });
  }
  return s3Client;
}

/**
 * Upload bank signature to S3
 * @returns S3 key (e.g., "signatures/bank-9-signature.png")
 */
export async function putBankSignature(params: {
  bankId: number;
  fileBytes: Buffer;
  contentType: string;
  extension: 'png' | 'jpg';
}): Promise<{ key: string }> {
  const key = `signatures/bank-${params.bankId}-signature.${params.extension}`;
  
  const command = new PutObjectCommand({
    Bucket: AWS_BUCKET,
    Key: key,
    Body: params.fileBytes,
    ContentType: params.contentType,
  });
  
  await getS3Client().send(command);
  
  return { key };
}

/**
 * Get bank signature bytes from S3
 */
export async function getBankSignatureBytes(key: string): Promise<{ bytes: Buffer; contentType: string }> {
  const command = new GetObjectCommand({
    Bucket: AWS_BUCKET,
    Key: key,
  });
  
  const response = await getS3Client().send(command);
  
  // Convert ReadableStream to Buffer
  const stream = response.Body as any;
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return {
    bytes: Buffer.concat(chunks),
    contentType: response.ContentType || 'application/octet-stream',
  };
}

/**
 * Delete bank signature from S3
 */
export async function deleteBankSignature(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: AWS_BUCKET,
    Key: key,
  });
  
  await getS3Client().send(command);
}

/**
 * Upload an invoice file to S3
 * @returns S3 key (e.g., "invoices/2026/02/1190006-123.pdf")
 */
export async function putInvoice(params: {
  key: string;
  fileBytes: Buffer;
  contentType: string;
}): Promise<{ key: string }> {
  console.log('[UPLOAD KEY]', params.key);
  const command = new PutObjectCommand({
    Bucket: AWS_BUCKET,
    Key: params.key,
    Body: params.fileBytes,
    ContentType: params.contentType,
  });
  await getS3Client().send(command);
  return { key: params.key };
}

/**
 * Generate a presigned URL for browser access to signature
 * @param key S3 key (e.g., "signatures/bank-9-signature.png")
 * @param expiresIn Expiration time in seconds (default: 120s = 2 minutes)
 * @returns Presigned URL for browser to access the signature
 */
export async function getPresignedSignatureUrl(key: string, expiresIn: number = 120): Promise<string> {
  const normalizedKey = key.replace(/^\/+/, '');
  console.log('[S3 KEY NORMALIZED]', { keyRaw: key, key: normalizedKey });
  const command = new GetObjectCommand({
    Bucket: AWS_BUCKET,
    Key: normalizedKey,
  });
  
  return await getSignedUrl(getS3Client(), command, { expiresIn });
}
