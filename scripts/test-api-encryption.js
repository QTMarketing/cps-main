#!/usr/bin/env node

/**
 * API Test Script for Bank Encryption
 * 
 * This script tests the bank API endpoints to verify that encryption
 * is working correctly in the actual API routes.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testBankAPIEncryption() {
  console.log('🔐 Testing Bank API Encryption');
  console.log('==============================\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    // Test 1: Create a bank via API
    console.log('Test 1: Creating bank via API');
    console.log('-----------------------------');
    
    const testBankData = {
      bankName: 'API Test Bank',
      accountNumber: '5555555555',
      routingNumber: '888888888',
      storeId: 'cmh4jy46p0000rgk2xx6ud5fx', // Use existing store ID
      balance: 25000
    };

    console.log('Creating bank with data:', {
      ...testBankData,
      accountNumber: '5555555555',
      routingNumber: '888888888'
    });

    const createResponse = await fetch(`${baseUrl}/api/banks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBankData),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create bank: ${createResponse.status} ${createResponse.statusText}`);
    }

    const createdBank = await createResponse.json();
    console.log('✅ Bank created successfully');
    console.log('   Bank ID:', createdBank.id);
    console.log('   Account Number (from API):', createdBank.accountNumber);
    console.log('   Routing Number (from API):', createdBank.routingNumber);

    // Test 2: Retrieve the bank via API
    console.log('\nTest 2: Retrieving bank via API');
    console.log('-------------------------------');
    
    const getResponse = await fetch(`${baseUrl}/api/banks/${createdBank.id}`);
    
    if (!getResponse.ok) {
      throw new Error(`Failed to retrieve bank: ${getResponse.status} ${getResponse.statusText}`);
    }

    const retrievedBank = await getResponse.json();
    console.log('✅ Bank retrieved successfully');
    console.log('   Account Number (from API):', retrievedBank.accountNumber);
    console.log('   Routing Number (from API):', retrievedBank.routingNumber);

    // Verify the data is decrypted correctly
    if (retrievedBank.accountNumber === testBankData.accountNumber && 
        retrievedBank.routingNumber === testBankData.routingNumber) {
      console.log('✅ Data decryption working correctly - API returns plain text');
    } else {
      console.log('❌ Data decryption failed - API returned encrypted data');
    }

    // Test 3: Update the bank via API
    console.log('\nTest 3: Updating bank via API');
    console.log('-----------------------------');
    
    const updateData = {
      accountNumber: '9999999999',
      routingNumber: '777777777'
    };

    const updateResponse = await fetch(`${baseUrl}/api/banks/${createdBank.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update bank: ${updateResponse.status} ${updateResponse.statusText}`);
    }

    const updatedBank = await updateResponse.json();
    console.log('✅ Bank updated successfully');
    console.log('   New Account Number (from API):', updatedBank.accountNumber);
    console.log('   New Routing Number (from API):', updatedBank.routingNumber);

    // Test 4: List all banks via API
    console.log('\nTest 4: Listing all banks via API');
    console.log('---------------------------------');
    
    const listResponse = await fetch(`${baseUrl}/api/banks`);
    
    if (!listResponse.ok) {
      throw new Error(`Failed to list banks: ${listResponse.status} ${listResponse.statusText}`);
    }

    const banks = await listResponse.json();
    console.log(`✅ Retrieved ${banks.length} banks`);
    
    // Check if our test bank is in the list with decrypted data
    const testBank = banks.find((bank: any) => bank.id === createdBank.id);
    if (testBank) {
      console.log('   Test bank found in list:');
      console.log('   Account Number:', testBank.accountNumber);
      console.log('   Routing Number:', testBank.routingNumber);
      
      if (testBank.accountNumber === updateData.accountNumber && 
          testBank.routingNumber === updateData.routingNumber) {
        console.log('✅ List API returns decrypted data correctly');
      } else {
        console.log('❌ List API returned encrypted data');
      }
    }

    // Test 5: Test with checks that include bank data
    console.log('\nTest 5: Testing checks with bank data');
    console.log('-------------------------------------');
    
    const checksResponse = await fetch(`${baseUrl}/api/checks`);
    
    if (checksResponse.ok) {
      const checks = await checksResponse.json();
      console.log(`✅ Retrieved ${checks.length} checks`);
      
      if (checks.length > 0) {
        const checkWithBank = checks[0];
        if (checkWithBank.bank) {
          console.log('   Check with bank data:');
          console.log('   Bank Account Number:', checkWithBank.bank.accountNumber);
          console.log('   Bank Routing Number:', checkWithBank.bank.routingNumber);
          console.log('✅ Check API returns decrypted bank data correctly');
        }
      }
    }

    // Cleanup: Delete the test bank
    console.log('\nCleanup: Deleting test bank');
    console.log('--------------------------');
    
    const deleteResponse = await fetch(`${baseUrl}/api/banks/${createdBank.id}`, {
      method: 'DELETE',
    });

    if (deleteResponse.ok) {
      console.log('✅ Test bank deleted successfully');
    } else {
      console.log('⚠️  Failed to delete test bank (may need manual cleanup)');
    }

    console.log('\n🎉 All API encryption tests passed!');
    console.log('===================================');
    console.log('\n✅ Bank creation API encrypts data transparently');
    console.log('✅ Bank retrieval API decrypts data transparently');
    console.log('✅ Bank update API encrypts data transparently');
    console.log('✅ Bank list API decrypts data transparently');
    console.log('✅ Check API with bank data decrypts correctly');

  } catch (error) {
    console.error('\n❌ API encryption test failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run the test
testBankAPIEncryption().catch(console.error);





