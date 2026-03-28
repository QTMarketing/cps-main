#!/usr/bin/env node

/**
 * Migration Script for Existing Bank Data
 * 
 * This script migrates existing unencrypted bank data to encrypted format.
 * Run this script after implementing the encryption middleware.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { prisma, encryptBankData } from '../src/lib/prisma';
import { isValidEncryptedString } from '../src/lib/encryption';

async function migrateExistingBanks() {
  console.log('🔄 Starting migration of existing bank data...');
  console.log('==============================================\n');

  try {
    // Get all banks
    const banks = await prisma.bank.findMany();
    console.log(`Found ${banks.length} banks to process`);

    let migratedCount = 0;
    let alreadyEncryptedCount = 0;
    let errorCount = 0;

    for (const bank of banks) {
      try {
        console.log(`\nProcessing bank: ${bank.bankName} (ID: ${bank.id})`);
        
        let needsUpdate = false;
        const updateData: any = {};

        // Check account number
        if (bank.accountNumber && !isValidEncryptedString(bank.accountNumber)) {
          console.log('  - Account number needs encryption');
          updateData.accountNumber = bank.accountNumber;
          needsUpdate = true;
        } else if (bank.accountNumber) {
          console.log('  - Account number already encrypted');
          alreadyEncryptedCount++;
        }

        // Check routing number
        if (bank.routingNumber && !isValidEncryptedString(bank.routingNumber)) {
          console.log('  - Routing number needs encryption');
          updateData.routingNumber = bank.routingNumber;
          needsUpdate = true;
        } else if (bank.routingNumber) {
          console.log('  - Routing number already encrypted');
          alreadyEncryptedCount++;
        }

        // Update if needed
        if (needsUpdate) {
          console.log('  - Encrypting and updating bank data...');
          
          // Encrypt the data
          const encryptedData = encryptBankData(updateData);
          
          // Update the bank
          await prisma.bank.update({
            where: { id: bank.id },
            data: encryptedData
          });
          
          console.log('  ✅ Bank updated successfully');
          migratedCount++;
        } else {
          console.log('  ℹ️  No update needed');
        }

      } catch (error) {
        console.error(`  ❌ Error processing bank ${bank.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`Total banks processed: ${banks.length}`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Already encrypted: ${alreadyEncryptedCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('All bank data is now encrypted.');
    } else {
      console.log('\n⚠️  Migration completed with errors.');
      console.log('Please review the errors above and retry if needed.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Please check your database connection and try again.');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateExistingBanks().catch(console.error);





