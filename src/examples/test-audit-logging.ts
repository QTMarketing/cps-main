/**
 * Test Script for Audit Logging System
 * 
 * This script tests all aspects of the audit logging system including
 * logging functions, API endpoints, and data integrity.
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

async function createTestUser() {
  const user = await prisma.user.create({
    data: {
      username: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'ADMIN',
      storeId: 'test-store-id',
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

async function testAuditLogCreation() {
  console.log('\n🧪 Testing Audit Log Creation...');
  
  const user = await createTestUser();
  
  // Create a test audit log
  const auditLog = await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'CREATE_CHECK',
      entityType: 'CHECK',
      entityId: 'test-check-123',
      oldValues: null,
      newValues: { amount: 1000, status: 'PENDING' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Test Browser)',
    },
  });

  console.log(`✅ Audit Log Created: ID ${auditLog.id}`);
  
  // Verify the audit log was created correctly
  const retrievedLog = await prisma.auditLog.findUnique({
    where: { id: auditLog.id },
    include: { user: true },
  });

  if (retrievedLog) {
    console.log(`✅ Audit Log Retrieved: Action ${retrievedLog.action}, Entity ${retrievedLog.entityType}`);
  } else {
    console.log(`❌ Failed to retrieve audit log`);
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.auditLog.delete({ where: { id: auditLog.id } });
}

async function testAuditLogAPI() {
  console.log('\n🧪 Testing Audit Log API...');
  
  const user = await createTestUser();
  const token = generateJWT(user);
  
  // Create some test audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: user.id,
        action: 'CREATE_CHECK',
        entityType: 'CHECK',
        entityId: 'check-1',
        newValues: { amount: 1000 },
        ipAddress: '192.168.1.1',
      },
      {
        userId: user.id,
        action: 'UPDATE_CHECK',
        entityType: 'CHECK',
        entityId: 'check-1',
        oldValues: { amount: 1000 },
        newValues: { amount: 1500 },
        ipAddress: '192.168.1.1',
      },
      {
        userId: user.id,
        action: 'CREATE_VENDOR',
        entityType: 'VENDOR',
        entityId: 'vendor-1',
        newValues: { name: 'Test Vendor' },
        ipAddress: '192.168.1.1',
      },
    ],
  });

  // Test GET /api/audit-logs
  const getResponse = await makeRequest('/api/audit-logs', 'GET', token);
  console.log(`✅ GET Audit Logs: Status ${getResponse.status} - ${getResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Test filtering by action
  const filterResponse = await makeRequest('/api/audit-logs?action=CREATE_CHECK', 'GET', token);
  console.log(`✅ Filter by Action: Status ${filterResponse.status} - ${filterResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Test filtering by entity type
  const entityFilterResponse = await makeRequest('/api/audit-logs?entityType=CHECK', 'GET', token);
  console.log(`✅ Filter by Entity Type: Status ${entityFilterResponse.status} - ${entityFilterResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Test pagination
  const paginationResponse = await makeRequest('/api/audit-logs?page=1&limit=2', 'GET', token);
  console.log(`✅ Pagination: Status ${paginationResponse.status} - ${paginationResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Test entity-specific audit logs
  const entityResponse = await makeRequest('/api/audit-logs/entity', 'POST', token, {
    entityType: 'CHECK',
    entityId: 'check-1',
  });
  console.log(`✅ Entity Audit Logs: Status ${entityResponse.status} - ${entityResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Test activity summary
  const summaryResponse = await makeRequest('/api/audit-logs/summary', 'PUT', token, {
    userId: user.id,
    days: 30,
  });
  console.log(`✅ Activity Summary: Status ${summaryResponse.status} - ${summaryResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Test CSV export
  const exportResponse = await makeRequest('/api/audit-logs/export', 'PATCH', token, {
    action: 'CREATE_CHECK',
    entityType: 'CHECK',
  });
  console.log(`✅ CSV Export: Status ${exportResponse.status} - ${exportResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);

  // Cleanup
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function testUnauthorizedAccess() {
  console.log('\n🧪 Testing Unauthorized Access...');
  
  // Test without token
  const noTokenResponse = await makeRequest('/api/audit-logs', 'GET', '');
  console.log(`❌ No Token: Status ${noTokenResponse.status} - ${noTokenResponse.status === 401 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Test with invalid token
  const invalidTokenResponse = await makeRequest('/api/audit-logs', 'GET', 'invalid-token');
  console.log(`❌ Invalid Token: Status ${invalidTokenResponse.status} - ${invalidTokenResponse.status === 401 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Test with non-admin user
  const regularUser = await createTestUser();
  await prisma.user.update({
    where: { id: regularUser.id },
    data: { role: 'USER' },
  });
  
  const regularToken = generateJWT(regularUser);
  const regularUserResponse = await makeRequest('/api/audit-logs', 'GET', regularToken);
  console.log(`❌ Non-Admin User: Status ${regularUserResponse.status} - ${regularUserResponse.status === 403 ? 'CORRECTLY REJECTED' : 'UNEXPECTED'}`);
  
  // Cleanup
  await prisma.user.delete({ where: { id: regularUser.id } });
}

async function testAuditLogIntegrity() {
  console.log('\n🧪 Testing Audit Log Integrity...');
  
  const user = await createTestUser();
  
  // Test complex JSON data
  const complexData = {
    check: {
      id: 'check-123',
      amount: 1000,
      status: 'PENDING',
      vendor: { name: 'Test Vendor', id: 'vendor-456' },
      bank: { name: 'Test Bank', balance: 5000 },
    },
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'API',
      version: '1.0',
    },
  };

  const auditLog = await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'CREATE_CHECK',
      entityType: 'CHECK',
      entityId: 'check-123',
      oldValues: null,
      newValues: complexData,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Test Browser)',
    },
  });

  // Verify complex data was stored correctly
  const retrievedLog = await prisma.auditLog.findUnique({
    where: { id: auditLog.id },
  });

  if (retrievedLog && retrievedLog.newValues) {
    const storedData = retrievedLog.newValues as any;
    if (storedData.check && storedData.check.amount === 1000) {
      console.log(`✅ Complex Data Storage: SUCCESS`);
    } else {
      console.log(`❌ Complex Data Storage: FAILED`);
    }
  } else {
    console.log(`❌ Complex Data Storage: FAILED`);
  }

  // Test data immutability (should not be able to update)
  try {
    await prisma.auditLog.update({
      where: { id: auditLog.id },
      data: { action: 'UPDATED_ACTION' },
    });
    console.log(`❌ Data Immutability: FAILED - Should not be able to update`);
  } catch (error) {
    console.log(`✅ Data Immutability: SUCCESS - Cannot update audit logs`);
  }

  // Cleanup
  await prisma.auditLog.delete({ where: { id: auditLog.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function testPerformance() {
  console.log('\n🧪 Testing Performance...');
  
  const user = await createTestUser();
  
  // Create multiple audit logs
  const startTime = Date.now();
  const auditLogs = [];
  
  for (let i = 0; i < 100; i++) {
    auditLogs.push({
      userId: user.id,
      action: 'CREATE_CHECK',
      entityType: 'CHECK',
      entityId: `check-${i}`,
      newValues: { amount: 1000 + i },
      ipAddress: '192.168.1.1',
    });
  }

  await prisma.auditLog.createMany({
    data: auditLogs,
  });

  const createTime = Date.now() - startTime;
  console.log(`✅ Bulk Creation: ${createTime}ms for 100 records`);

  // Test query performance
  const queryStartTime = Date.now();
  const logs = await prisma.auditLog.findMany({
    where: { userId: user.id },
    take: 50,
    orderBy: { timestamp: 'desc' },
  });
  const queryTime = Date.now() - queryStartTime;
  console.log(`✅ Query Performance: ${queryTime}ms for 50 records`);

  // Cleanup
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests() {
  console.log('🚀 Starting Audit Logging System Tests...');
  
  try {
    await testAuditLogCreation();
    await testAuditLogAPI();
    await testUnauthorizedAccess();
    await testAuditLogIntegrity();
    await testPerformance();
    
    console.log('\n✅ All audit logging tests completed!');
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





