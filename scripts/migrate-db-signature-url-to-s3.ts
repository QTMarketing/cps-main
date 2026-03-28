#!/usr/bin/env tsx
/**
 * Migrate DB Signature URLs to S3 Format
 * 
 * Updates database signature_url values from legacy paths to existing S3 keys.
 * Assumes signatures already exist in S3 as "signatures/bank-{id}-signature.png"
 * 
 * Usage:
 *   npm run sig:dbfix:dry  (dry run - shows what would change)
 *   npm run sig:dbfix      (real run - updates database)
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

// AWS Configuration (from env)
const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Validate AWS config
if (!AWS_REGION || !AWS_BUCKET || !AWS_KEY_ID || !AWS_SECRET) {
  console.error('❌ Missing AWS configuration. Required env vars:');
  console.error('   - AWS_REGION');
  console.error('   - AWS_S3_BUCKET');
  console.error('   - AWS_ACCESS_KEY_ID');
  console.error('   - AWS_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_KEY_ID,
    secretAccessKey: AWS_SECRET,
  },
});

// Debug: Log AWS configuration
console.log('[AWS DEBUG]', {
  bucket: JSON.stringify(AWS_BUCKET),
  region: AWS_REGION,
  accessKeyLast4: AWS_KEY_ID?.slice(-4),
});

interface MigrationResult {
  bankId: number;
  bankName: string;
  oldValue: string;
  newKey: string;
  status: 'migrated' | 'missing';
}

/**
 * Check if an S3 object exists
 */
async function s3ObjectExists(key: string, bankId: number): Promise<boolean> {
  // Debug: Log before HeadObject call
  console.log('[S3 HEAD]', {
    bankId,
    key: JSON.stringify(key),
    len: key.length,
  });

  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: AWS_BUCKET,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    // Debug: Log HeadObject error
    console.log('[S3 HEAD ERROR]', {
      bankId,
      key: JSON.stringify(key),
      code: error?.name,
      status: error?.$metadata?.httpStatusCode,
      message: error?.message,
    });

    // Handle 404 - object not found (expected case)
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    
    // Handle 403 - permission denied or not accessible (treat as not found)
    if (error.name === 'Forbidden' || error.$metadata?.httpStatusCode === 403) {
      console.log('[S3 HEAD WARN] Not accessible or missing', {
        bucket: AWS_BUCKET,
        key,
        status: 403,
      });
      return false;
    }
    
    // Re-throw unexpected errors (5xx, network issues, etc.)
    throw error;
  }
}

/**
 * Migrate a single bank's signature URL
 */
async function migrateBank(bank: { id: number; bank_name: string | null; signature_url: string }): Promise<MigrationResult> {
  const bankId = bank.id;
  const bankName = bank.bank_name || 'Unknown';
  const oldValue = bank.signature_url;
  
  // Expected S3 key format
  const newKey = `signatures/bank-${bankId}-signature.png`;

  console.log(`\n📦 Bank ${bankId}: ${bankName}`);
  console.log(`  Old: ${oldValue}`);
  console.log(`  New: ${newKey}`);

  // Check if new key exists in S3
  const exists = await s3ObjectExists(newKey, bankId);

  if (!exists) {
    console.log(`  ❌ Not found in S3`);
    return {
      bankId,
      bankName,
      oldValue,
      newKey,
      status: 'missing',
    };
  }

  console.log(`  ✅ Found in S3`);

  // Update database
  if (DRY_RUN) {
    console.log(`  🔸 DRY RUN: Would update signature_url to ${newKey}`);
  } else {
    await prisma.bank.update({
      where: { id: bankId },
      data: { signature_url: newKey },
    });
    console.log(`  ✅ Database updated`);
  }

  return {
    bankId,
    bankName,
    oldValue,
    newKey,
    status: 'migrated',
  };
}

/**
 * Main migration function
 */
async function main() {
  console.log('🔧 Database Signature URL Migration to S3 Format');
  console.log('═'.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔸 DRY RUN (no changes)' : '🔥 REAL RUN (will modify DB)'}`);
  console.log(`Bucket: ${AWS_BUCKET}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log('═'.repeat(60));

  // Find all banks with legacy signature URLs
  console.log('\n📊 Scanning for legacy signature URLs...');
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
    },
    orderBy: {
      id: 'asc',
    },
  });

  if (legacyBanks.length === 0) {
    console.log('\n✅ No legacy signature URLs found. All banks are already using S3 format!');
    return;
  }

  console.log(`\n⚠️  Found ${legacyBanks.length} bank(s) with legacy signature URLs\n`);

  // Migrate each bank
  const results: MigrationResult[] = [];

  for (const bank of legacyBanks) {
    const result = await migrateBank(bank);
    results.push(result);
  }

  // Print summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('═'.repeat(60));

  const migrated = results.filter(r => r.status === 'migrated');
  const missing = results.filter(r => r.status === 'missing');

  console.log(`\nTotal legacy rows: ${results.length}`);
  console.log(`✅ Migrated: ${migrated.length}`);
  console.log(`❌ Missing in S3: ${missing.length}`);

  // Detailed lists
  if (migrated.length > 0) {
    console.log('\n✅ MIGRATED:');
    console.log('─'.repeat(60));
    migrated.forEach(r => {
      console.log(`  Bank ${r.bankId}: ${r.bankName}`);
      console.log(`    Old: ${r.oldValue}`);
      console.log(`    New: ${r.newKey}`);
    });
  }

  if (missing.length > 0) {
    console.log('\n❌ MISSING IN S3 (not migrated):');
    console.log('─'.repeat(60));
    missing.forEach(r => {
      console.log(`  Bank ${r.bankId}: ${r.bankName}`);
      console.log(`    Old: ${r.oldValue}`);
      console.log(`    Attempted: ${r.newKey}`);
      console.log(`    ⚠️  Action: Upload signature via admin UI`);
    });
    console.log('\nNote: 403 errors may indicate missing objects or insufficient S3 permissions.');
    console.log('See: docs/aws-signature-migration-permissions.md for IAM policy setup.');
  }

  console.log('\n' + '═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n🔸 DRY RUN COMPLETE - No changes were made to the database');
    console.log('To perform actual migration, run: npm run sig:dbfix');
  } else {
    console.log('\n✅ MIGRATION COMPLETE');
    if (missing.length > 0) {
      console.log(`\n⚠️  ${missing.length} bank(s) need signature upload (see above)`);
    }
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
