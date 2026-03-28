#!/usr/bin/env tsx
/**
 * Migrate Legacy Signature URLs
 * 
 * Migrates signature URLs from legacy "/uploads/signatures/" format to new "signatures/" format.
 * Legacy files are already in S3, so this script copies them to the new prefix.
 * 
 * Usage:
 *   npm run sig:migrate:dry  (dry run - shows what would happen)
 *   npm run sig:migrate      (real run - performs migration)
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

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

interface MigrationResult {
  bankId: number;
  bankName: string;
  oldValue: string;
  foundLegacyKey?: string;
  newKey?: string;
  status: 'migrated' | 'missing' | 'already_exists' | 'error';
  error?: string;
}

/**
 * Check if an S3 object exists
 */
async function s3ObjectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: AWS_BUCKET,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error; // Re-throw unexpected errors
  }
}

/**
 * Find the legacy S3 key from database path
 */
async function findLegacyKey(dbPath: string): Promise<string | null> {
  // Try different key formats
  const candidates = [
    dbPath.replace(/^\//, ''),                    // "/uploads/..." -> "uploads/..."
    dbPath.substring(1),                          // Same as above
    'public' + dbPath,                            // "/uploads/..." -> "public/uploads/..."
    dbPath,                                       // Keep as-is (unlikely but try)
  ];

  // Remove duplicates
  const uniqueCandidates = [...new Set(candidates)];

  console.log(`  🔍 Checking candidates: ${uniqueCandidates.join(', ')}`);

  for (const candidate of uniqueCandidates) {
    if (await s3ObjectExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Copy S3 object to new key
 */
async function copyS3Object(sourceKey: string, destKey: string): Promise<void> {
  await s3Client.send(new CopyObjectCommand({
    Bucket: AWS_BUCKET,
    CopySource: `${AWS_BUCKET}/${sourceKey}`,
    Key: destKey,
  }));
}

/**
 * Migrate a single bank's signature
 */
async function migrateBank(bank: { id: number; bank_name: string | null; signature_url: string }): Promise<MigrationResult> {
  const bankId = bank.id;
  const bankName = bank.bank_name || 'Unknown';
  const oldValue = bank.signature_url;

  console.log(`\n📦 Bank ${bankId}: ${bankName}`);
  console.log(`  Old value: ${oldValue}`);

  try {
    // Extract extension from legacy path
    const ext = path.extname(oldValue).replace('.', '') || 'png';
    const newKey = `signatures/bank-${bankId}-signature.${ext}`;

    console.log(`  New key: ${newKey}`);

    // Check if new key already exists
    if (await s3ObjectExists(newKey)) {
      console.log(`  ✅ New key already exists in S3 - updating DB only`);
      
      if (!DRY_RUN) {
        await prisma.bank.update({
          where: { id: bankId },
          data: { signature_url: newKey },
        });
      }

      return {
        bankId,
        bankName,
        oldValue,
        newKey,
        status: 'already_exists',
      };
    }

    // Find legacy object in S3
    const legacyKey = await findLegacyKey(oldValue);

    if (!legacyKey) {
      console.log(`  ❌ Legacy file not found in S3`);
      return {
        bankId,
        bankName,
        oldValue,
        status: 'missing',
      };
    }

    console.log(`  ✅ Found legacy file: ${legacyKey}`);

    // Copy object to new key
    if (DRY_RUN) {
      console.log(`  🔸 DRY RUN: Would copy ${legacyKey} → ${newKey}`);
      console.log(`  🔸 DRY RUN: Would update bank.signature_url to ${newKey}`);
    } else {
      console.log(`  📋 Copying to new key...`);
      await copyS3Object(legacyKey, newKey);
      
      console.log(`  💾 Updating database...`);
      await prisma.bank.update({
        where: { id: bankId },
        data: { signature_url: newKey },
      });
      
      console.log(`  ✅ Migration complete`);
    }

    return {
      bankId,
      bankName,
      oldValue,
      foundLegacyKey: legacyKey,
      newKey,
      status: 'migrated',
    };
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return {
      bankId,
      bankName,
      oldValue,
      status: 'error',
      error: (error as Error).message,
    };
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Legacy Signature Migration');
  console.log('═'.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔸 DRY RUN (no changes)' : '🔥 REAL RUN (will modify)'}`);
  console.log(`Bucket: ${AWS_BUCKET}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log('═'.repeat(60));

  // Find all banks with legacy signature URLs
  console.log('\n📊 Scanning for legacy signatures...');
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
    console.log('\n✅ No legacy signatures found. All banks are already migrated!');
    return;
  }

  console.log(`\n⚠️  Found ${legacyBanks.length} bank(s) with legacy signatures\n`);

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
  const alreadyExists = results.filter(r => r.status === 'already_exists');
  const missing = results.filter(r => r.status === 'missing');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\nTotal legacy rows: ${results.length}`);
  console.log(`✅ Migrated: ${migrated.length}`);
  console.log(`📋 Already exists: ${alreadyExists.length}`);
  console.log(`❌ Missing: ${missing.length}`);
  console.log(`⚠️  Errors: ${errors.length}`);

  // Detailed lists
  if (migrated.length > 0) {
    console.log('\n✅ MIGRATED:');
    console.log('─'.repeat(60));
    migrated.forEach(r => {
      console.log(`  Bank ${r.bankId}: ${r.bankName}`);
      console.log(`    Old: ${r.oldValue}`);
      console.log(`    Found: ${r.foundLegacyKey}`);
      console.log(`    New: ${r.newKey}`);
    });
  }

  if (alreadyExists.length > 0) {
    console.log('\n📋 ALREADY EXISTS (DB updated):');
    console.log('─'.repeat(60));
    alreadyExists.forEach(r => {
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
      console.log(`    ⚠️  Action required: Manual reupload via UI`);
    });
  }

  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    console.log('─'.repeat(60));
    errors.forEach(r => {
      console.log(`  Bank ${r.bankId}: ${r.bankName}`);
      console.log(`    Old: ${r.oldValue}`);
      console.log(`    Error: ${r.error}`);
    });
  }

  console.log('\n' + '═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n🔸 DRY RUN COMPLETE - No changes were made');
    console.log('To perform actual migration, run: npm run sig:migrate');
  } else {
    console.log('\n✅ MIGRATION COMPLETE');
    if (missing.length > 0 || errors.length > 0) {
      console.log('\n⚠️  Some banks require manual attention (see above)');
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
