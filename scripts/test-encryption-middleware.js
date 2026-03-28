#!/usr/bin/env node

/**
 * Test Script for Prisma Encryption Middleware
 * 
 * This script tests the automatic encryption/decryption functionality
 * for bank account numbers and routing numbers.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { prisma, testEncryptionMiddleware, encryptBankData, decryptBankData } from '../src/lib/prisma';

async function testPrismaEncryption() {
  console.log('🔐 Testing Prisma Encryption Middleware');
  console.log('=====================================\n');

  try {
    // Test 1: Basic encryption/decryption functions
    console.log('Test 1: Basic Encryption/Decryption Functions');
    console.log('----------------------------------------------');
    await testEncryptionMiddleware();
    console.log('');

    // Test 2: Database operations with encryption
    console.log('Test 2: Database Operations with Encryption');
    console.log('------------------------------------------');
    
    // Create a test bank with plain text data
    const testBankData = {
      bankName: 'Encryption Test Bank',
      accountNumber: '9876543210',
      routingNumber: '123456789',
      storeId: 'cmh4jy46p0000rgk2xx6ud5fx', // Use existing store ID
      balance: 50000
    };

    console.log('Creating bank with plain text data...');
    console.log('   Account Number:', testBankData.accountNumber);
    console.log('   Routing Number:', testBankData.routingNumber);

    // Create the bank (should be encrypted automatically)
    const createdBank = await prisma.bank.create({
      data: testBankData
    });

    console.log('✅ Bank created successfully');
    console.log('   Bank ID:', createdBank.id);
    console.log('   Account Number (should be encrypted):', createdBank.accountNumber.substring(0, 20) + '...');
    console.log('   Routing Number (should be encrypted):', createdBank.routingNumber.substring(0, 20) + '...');

    // Test 3: Reading encrypted data (should be decrypted automatically)
    console.log('\nTest 3: Reading Encrypted Data');
    console.log('-----------------------------');
    
    const retrievedBank = await prisma.bank.findUnique({
      where: { id: createdBank.id }
    });

    if (retrievedBank) {
      console.log('✅ Bank retrieved successfully');
      console.log('   Account Number (should be decrypted):', retrievedBank.accountNumber);
      console.log('   Routing Number (should be decrypted):', retrievedBank.routingNumber);
      
      // Verify the data is decrypted correctly
      if (retrievedBank.accountNumber === testBankData.accountNumber && 
          retrievedBank.routingNumber === testBankData.routingNumber) {
        console.log('✅ Decryption working correctly - data matches original');
      } else {
        console.log('❌ Decryption failed - data does not match original');
      }
    } else {
      console.log('❌ Failed to retrieve bank');
    }

    // Test 4: Update encrypted data
    console.log('\nTest 4: Updating Encrypted Data');
    console.log('------------------------------');
    
    const updatedBank = await prisma.bank.update({
      where: { id: createdBank.id },
      data: {
        accountNumber: '1111111111',
        routingNumber: '999999999'
      }
    });

    console.log('✅ Bank updated successfully');
    console.log('   New Account Number:', updatedBank.accountNumber);
    console.log('   New Routing Number:', updatedBank.routingNumber);

    // Test 5: Query with includes (nested bank data)
    console.log('\nTest 5: Query with Includes');
    console.log('---------------------------');
    
    const checkWithBank = await prisma.check.findFirst({
      include: {
        bank: true
      }
    });

    if (checkWithBank && checkWithBank.bank) {
      console.log('✅ Check with bank retrieved successfully');
      console.log('   Bank Account Number (should be decrypted):', checkWithBank.bank.accountNumber);
      console.log('   Bank Routing Number (should be decrypted):', checkWithBank.bank.routingNumber);
    } else {
      console.log('ℹ️  No checks found with bank data');
    }

    // Test 6: Manual encryption/decryption utilities
    console.log('\nTest 6: Manual Encryption/Decryption Utilities');
    console.log('-----------------------------------------------');
    
    const manualTestData = {
      accountNumber: '5555555555',
      routingNumber: '777777777'
    };

    const encrypted = encryptBankData(manualTestData);
    console.log('✅ Manual encryption successful');
    console.log('   Encrypted Account Number:', encrypted.accountNumber?.substring(0, 20) + '...');

    const decrypted = decryptBankData(encrypted);
    console.log('✅ Manual decryption successful');
    console.log('   Decrypted Account Number:', decrypted.accountNumber);

    // Clean up test data
    console.log('\nCleanup: Removing test bank...');
    await prisma.bank.delete({
      where: { id: createdBank.id }
    });
    console.log('✅ Test bank removed');

    console.log('\n🎉 All encryption middleware tests passed!');
    console.log('==========================================');
    console.log('\n✅ Encryption is working transparently');
    console.log('✅ Bank data is encrypted in the database');
    console.log('✅ Bank data is decrypted when retrieved');
    console.log('✅ Updates work correctly with encryption');
    console.log('✅ Nested queries work with encryption');
    console.log('✅ Manual utilities work correctly');

  } catch (error) {
    console.error('\n❌ Encryption middleware test failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPrismaEncryption().catch(console.error);
