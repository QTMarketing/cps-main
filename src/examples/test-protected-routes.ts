/**
 * Test Script for Protected API Routes
 * 
 * This script demonstrates how to test the RBAC-protected API routes
 * with different user roles and permissions.
 */

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const BASE_URL = 'http://localhost:3000';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function createTestUser(role: 'ADMIN' | 'MANAGER' | 'USER', storeId: string) {
  const user = await prisma.user.create({
    data: {
      username: `test-${role.toLowerCase()}-${Date.now()}`,
      email: `test-${role.toLowerCase()}@example.com`,
      password: 'TestPassword123!',
      role,
      storeId,
    },
  });
  
  return user;
}

function generateJWT(user: any) {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '1h' }
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

async function testCheckCreation() {
  console.log('\n🧪 Testing Check Creation...');
  
  // Create test users
  const store = await prisma.store.findFirst();
  if (!store) {
    console.error('No store found. Please create a store first.');
    return;
  }
  
  const adminUser = await createTestUser('ADMIN', store.id);
  const managerUser = await createTestUser('MANAGER', store.id);
  const regularUser = await createTestUser('USER', store.id);
  
  // Create test bank and vendor
  const bank = await prisma.bank.create({
    data: {
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      routingNumber: '021000021',
      storeId: store.id,
      balance: 10000,
    },
  });
  
  const vendor = await prisma.vendor.create({
    data: {
      vendorName: 'Test Vendor',
      vendorType: 'MERCHANDISE',
      storeId: store.id,
      contact: { email: 'test@vendor.com' },
    },
  });
  
  const checkData = {
    checkNumber: `TEST-${Date.now()}`,
    paymentMethod: 'CHECK',
    bankId: bank.id,
    vendorId: vendor.id,
    amount: 100.00,
    memo: 'Test check',
    issuedBy: adminUser.id,
  };
  
  // Test with ADMIN (should succeed)
  const adminToken = generateJWT(adminUser);
  const adminResponse = await makeRequest('/api/checks', 'POST', adminToken, checkData);
  console.log(`✅ ADMIN: Status ${adminResponse.status} - ${adminResponse.status === 201 ? 'SUCCESS' : 'FAILED'}`);
  
  // Test with MANAGER (should succeed)
  const managerToken = generateJWT(managerUser);
  const managerResponse = await makeRequest('/api/checks', 'POST', managerToken, checkData);
  console.log(`✅ MANAGER: Status ${managerResponse.status} - ${managerResponse.status === 201 ? 'SUCCESS' : 'FAILED'}`);
  
  // Test with USER (should succeed - users can create checks)
  const userToken = generateJWT(regularUser);
  const userResponse = await makeRequest('/api/checks', 'POST', userToken, checkData);
  console.log(`✅ USER: Status ${userResponse.status} - ${userResponse.status === 201 ? 'SUCCESS' : 'FAILED'}`);
  
  // Cleanup
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, managerUser.id, regularUser.id] } } });
  await prisma.bank.delete({ where: { id: bank.id } });
  await prisma.vendor.delete({ where: { id: vendor.id } });
}

async function testUserManagement() {
  console.log('\n🧪 Testing User Management...');
  
  const store = await prisma.store.findFirst();
  if (!store) {
    console.error('No store found. Please create a store first.');
    return;
  }
  
  const adminUser = await createTestUser('ADMIN', store.id);
  const managerUser = await createTestUser('MANAGER', store.id);
  const regularUser = await createTestUser('USER', store.id);
  
  const newUserData = {
    username: `new-user-${Date.now()}`,
    email: `new-user-${Date.now()}@example.com`,
    password: 'NewPassword123!',
    role: 'USER',
    storeId: store.id,
  };
  
  // Test with ADMIN (should succeed)
  const adminToken = generateJWT(adminUser);
  const adminResponse = await makeRequest('/api/users', 'POST', adminToken, newUserData);
  console.log(`✅ ADMIN: Status ${adminResponse.status} - ${adminResponse.status === 201 ? 'SUCCESS' : 'FAILED'}`);
  
  // Test with MANAGER (should fail - no user management permission)
  const managerToken = generateJWT(managerUser);
  const managerResponse = await makeRequest('/api/users', 'POST', managerToken, newUserData);
  console.log(`❌ MANAGER: Status ${managerResponse.status} - ${managerResponse.status === 403 ? 'CORRECTLY BLOCKED' : 'UNEXPECTED'}`);
  
  // Test with USER (should fail - no user management permission)
  const userToken = generateJWT(regularUser);
  const userResponse = await makeRequest('/api/users', 'POST', userToken, newUserData);
  console.log(`❌ USER: Status ${userResponse.status} - ${userResponse.status === 403 ? 'CORRECTLY BLOCKED' : 'UNEXPECTED'}`);
  
  // Cleanup
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, managerUser.id, regularUser.id] } } });
}

async function testReportsAccess() {
  console.log('\n🧪 Testing Reports Access...');
  
  const store = await prisma.store.findFirst();
  if (!store) {
    console.error('No store found. Please create a store first.');
    return;
  }
  
  const adminUser = await createTestUser('ADMIN', store.id);
  const managerUser = await createTestUser('MANAGER', store.id);
  const regularUser = await createTestUser('USER', store.id);
  
  // Test reports access with different roles
  const adminToken = generateJWT(adminUser);
  const adminResponse = await makeRequest('/api/reports', 'GET', adminToken);
  console.log(`✅ ADMIN: Status ${adminResponse.status} - ${adminResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
  
  const managerToken = generateJWT(managerUser);
  const managerResponse = await makeRequest('/api/reports', 'GET', managerToken);
  console.log(`✅ MANAGER: Status ${managerResponse.status} - ${managerResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
  
  const userToken = generateJWT(regularUser);
  const userResponse = await makeRequest('/api/reports', 'GET', userToken);
  console.log(`❌ USER: Status ${userResponse.status} - ${userResponse.status === 403 ? 'CORRECTLY BLOCKED' : 'UNEXPECTED'}`);
  
  // Cleanup
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, managerUser.id, regularUser.id] } } });
}

async function testUnauthorizedAccess() {
  console.log('\n🧪 Testing Unauthorized Access...');
  
  // Test without token
  const noTokenResponse = await makeRequest('/api/checks', 'GET', '');
  console.log(`❌ No Token: Status ${noTokenResponse.status} - ${noTokenResponse.status === 401 ? 'CORRECTLY BLOCKED' : 'UNEXPECTED'}`);
  
  // Test with invalid token
  const invalidTokenResponse = await makeRequest('/api/checks', 'GET', 'invalid-token');
  console.log(`❌ Invalid Token: Status ${invalidTokenResponse.status} - ${invalidTokenResponse.status === 401 ? 'CORRECTLY BLOCKED' : 'UNEXPECTED'}`);
  
  // Test with expired token
  const expiredToken = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '-1h' });
  const expiredTokenResponse = await makeRequest('/api/checks', 'GET', expiredToken);
  console.log(`❌ Expired Token: Status ${expiredTokenResponse.status} - ${expiredTokenResponse.status === 401 ? 'CORRECTLY BLOCKED' : 'UNEXPECTED'}`);
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests() {
  console.log('🚀 Starting Protected API Routes Tests...');
  
  try {
    await testCheckCreation();
    await testUserManagement();
    await testReportsAccess();
    await testUnauthorizedAccess();
    
    console.log('\n✅ All tests completed!');
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





