#!/usr/bin/env tsx
/**
 * Report Legacy Signatures
 * 
 * Identifies all banks with legacy signature URLs (local file paths)
 * that need migration to S3.
 * 
 * Usage: npm run report:legacy-sigs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Scanning for legacy signature URLs...\n');

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
    },
    orderBy: {
      id: 'asc',
    },
  });

  if (legacyBanks.length === 0) {
    console.log('✅ No legacy signatures found. All banks are using S3.');
    return;
  }

  console.log(`⚠️  Found ${legacyBanks.length} bank(s) with legacy signature URLs:\n`);
  
  // Print table header
  console.log('─'.repeat(100));
  console.log(
    'ID'.padEnd(6) +
    'Bank Name'.padEnd(30) +
    'Signature URL'.padEnd(45) +
    'Created'
  );
  console.log('─'.repeat(100));

  // Print each bank
  for (const bank of legacyBanks) {
    const bankName = (bank.bank_name || 'N/A').substring(0, 28);
    const sigUrl = (bank.signature_url || '').substring(0, 43);
    const created = bank.created_at.toISOString().split('T')[0];
    
    console.log(
      String(bank.id).padEnd(6) +
      bankName.padEnd(30) +
      sigUrl.padEnd(45) +
      created
    );
  }

  console.log('─'.repeat(100));
  console.log(`\nTotal: ${legacyBanks.length} bank(s) need migration\n`);
  
  console.log('📋 Next Steps:');
  console.log('1. Option A: Manual reupload via admin UI for each bank');
  console.log('2. Option B: Use API migration endpoint: POST /api/admin/signatures/legacy');
  console.log('   - Requires LEGACY_BASE_URL env var if files are hosted elsewhere');
  console.log('   - Or set signature_url to null and reupload fresh\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
