#!/usr/bin/env tsx
import 'dotenv/config';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function testHeadObject() {
  const bucket = process.env.AWS_S3_BUCKET;
  const key = 'signatures/bank-1-signature.png';

  console.log(`Testing HeadObject on: s3://${bucket}/${key}`);

  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    console.log('HEAD OK');
  } catch (error: any) {
    console.log('Error name:', error.name);
    console.log('HTTP Status:', error.$metadata?.httpStatusCode);
    console.log('Message:', error.message);
  }
}

testHeadObject();
