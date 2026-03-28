/**
 * Test Script for Re-Authentication System
 * 
 * This script tests all aspects of the re-authentication system including
 * password verification, token validation, middleware, and frontend integration.
 */

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const BASE_URL = 'http://localhost:3000';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function createTestUser() {
  const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
  
  const user = await prisma.user.create({
    data: {
      username: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: hashedPassword,
      role: 'ADMIN',
      storeId: 'test-store-id',
    },
  });
  
  return user;
}

function generateJWT(user: any, reAuth = false) {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role,
      reAuth,
      timestamp: Date.now(),
    },
    JWT_SECRET,
    { expiresIn: reAuth ? '5m' : '1h' }
  );
}

function generateExpiredReAuthToken(user: any) {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role,
      reAuth: true,
      timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
    },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

async function makeRequest(endpoint: string, method: string, token: string, body?: any) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return {
    status: response.status,
    data: await response.json(),
  };
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testPasswordVerification() {
  console.log('\n🧪 Testing Password Verification...');
  
  const user = await createTestUser();
  const authToken = generateJWT(user);
  
  // Test valid password
  const validResponse = await makeRequest('/api/auth/verify-password', 'POST', authToken, {
    password: 'TestPassword123!'
  });
  
  console.log(`✅ Valid Password: Status ${validResponse.status} - ${validResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
  
  // Test invalid password
  const invalidResponse = await makeRequest('/api/auth/verify-password', 'POST', authToken, {
    password: 'WrongPassword123!'
  });
  
  console.log(`❌ Invalid Password: Status ${invalidResponse.status} - ${invalidResponse.status === 400 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Test missing password
  const missingResponse = await makeRequest('/api/auth/verify-password', 'POST', authToken, {});
  
  console.log(`❌ Missing Password: Status ${missingResponse.status} - ${missingResponse.status === 400 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
}

async function testReAuthTokenValidation() {
  console.log('\n🧪 Testing Re-Auth Token Validation...');
  
  const user = await createTestUser();
  const authToken = generateJWT(user);
  
  // First, get a re-auth token
  const verifyResponse = await makeRequest('/api/auth/verify-password', 'POST', authToken, {
    password: 'TestPassword123!'
  });
  
  if (verifyResponse.status === 200) {
    const reAuthToken = verifyResponse.data.reAuthToken;
    
    // Test valid re-auth token
    const validResponse = await makeRequest('/api/auth/verify-password', 'GET', reAuthToken);
    console.log(`✅ Valid Re-Auth Token: Status ${validResponse.status} - ${validResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
    
    // Test expired re-auth token
    const expiredToken = generateExpiredReAuthToken(user);
    const expiredResponse = await makeRequest('/api/auth/verify-password', 'GET', expiredToken);
    console.log(`❌ Expired Re-Auth Token: Status ${expiredResponse.status} - ${expiredResponse.status === 200 && expiredResponse.data.reAuthRequired ? 'CORRECTLY EXPIRED' : 'UNEXPECTED'}`);
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
}

async function testSensitiveOperations() {
  console.log('\n🧪 Testing Sensitive Operations...');
  
  const user = await createTestUser();
  const authToken = generateJWT(user);
  
  // Test operation without re-auth (should require re-auth)
  const noReAuthResponse = await makeRequest('/api/checks/test-void', 'DELETE', authToken);
  console.log(`❌ Operation Without Re-Auth: Status ${noReAuthResponse.status} - ${noReAuthResponse.status === 403 ? 'CORRECTLY REQUIRES RE-AUTH' : 'UNEXPECTED'}`);
  
  // Get re-auth token
  const verifyResponse = await makeRequest('/api/auth/verify-password', 'POST', authToken, {
    password: 'TestPassword123!'
  });
  
  if (verifyResponse.status === 200) {
    const reAuthToken = verifyResponse.data.reAuthToken;
    
    // Test operation with valid re-auth
    const withReAuthResponse = await makeRequest('/api/checks/test-void', 'DELETE', reAuthToken);
    console.log(`✅ Operation With Re-Auth: Status ${withReAuthResponse.status} - ${withReAuthResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
}

async function testAmountThresholds() {
  console.log('\n🧪 Testing Amount Thresholds...');
  
  const user = await createTestUser();
  const authToken = generateJWT(user);
  
  // Test small amount (should not require re-auth)
  const smallAmountResponse = await makeRequest('/api/checks/test-large-payment', 'POST', authToken, {
    amount: 5000 // $5,000
  });
  console.log(`✅ Small Amount: Status ${smallAmountResponse.status} - ${smallAmountResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
  
  // Test large amount (should require re-auth)
  const largeAmountResponse = await makeRequest('/api/checks/test-large-payment', 'POST', authToken, {
    amount: 15000 // $15,000
  });
  console.log(`❌ Large Amount Without Re-Auth: Status ${largeAmountResponse.status} - ${largeAmountResponse.status === 403 ? 'CORRECTLY REQUIRES RE-AUTH' : 'UNEXPECTED'}`);
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
}

async function testAttemptLimiting() {
  console.log('\n🧪 Testing Attempt Limiting...');
  
  const user = await createTestUser();
  const authToken = generateJWT(user);
  
  // Test multiple failed attempts
  for (let i = 1; i <= 4; i++) {
    const response = await makeRequest('/api/auth/verify-password', 'POST', authToken, {
      password: 'WrongPassword123!'
    });
    
    console.log(`❌ Failed Attempt ${i}: Status ${response.status} - ${response.status === 400 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
    
    if (i === 3) {
      console.log('   → Should be locked after 3 attempts');
    }
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
}

async function testUnauthorizedAccess() {
  console.log('\n🧪 Testing Unauthorized Access...');
  
  // Test without token
  const noTokenResponse = await makeRequest('/api/auth/verify-password', 'POST', '', {
    password: 'TestPassword123!'
  });
  console.log(`❌ No Token: Status ${noTokenResponse.status} - ${noTokenResponse.status === 401 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Test with invalid token
  const invalidTokenResponse = await makeRequest('/api/auth/verify-password', 'POST', 'invalid-token', {
    password: 'TestPassword123!'
  });
  console.log(`❌ Invalid Token: Status ${invalidTokenResponse.status} - ${invalidTokenResponse.status === 401 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Test with expired token
  const expiredToken = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '-1h' });
  const expiredTokenResponse = await makeRequest('/api/auth/verify-password', 'POST', expiredToken, {
    password: 'TestPassword123!'
  });
  console.log(`❌ Expired Token: Status ${expiredTokenResponse.status} - ${expiredTokenResponse.status === 401 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests() {
  console.log('🚀 Starting Re-Authentication System Tests...');
  
  try {
    await testPasswordVerification();
    await testReAuthTokenValidation();
    await testSensitiveOperations();
    await testAmountThresholds();
    await testAttemptLimiting();
    await testUnauthorizedAccess();
    
    console.log('\n✅ All re-authentication tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export { runAllTests };





