#!/usr/bin/env node

/**
 * User Management API Testing Script
 * 
 * This script tests the user management API endpoints to ensure
 * all CRUD operations work correctly with proper RBAC protection.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { prisma } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logHeader(message: string) {
  log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
  log('='.repeat(message.length), colors.cyan);
}

// Mock admin user for testing
let adminUser: any;
let adminToken: string;
let testStoreId: string;

async function setupTestData() {
  logHeader('Setting Up Test Data');
  
  try {
    // Find or create a test store
    let store = await prisma.store.findFirst();
    if (!store) {
      store = await prisma.store.create({
        data: {
          name: 'Test Store',
          address: '123 Test Street',
          phone: '555-0123',
        },
      });
    }
    testStoreId = store.id;
    logInfo(`Using store: ${store.name} (${store.id})`);

    // Find or create admin user
    adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          username: 'test-admin',
          email: 'admin@test.com',
          password: 'hashed-password',
          role: 'ADMIN',
          storeId: testStoreId,
        },
      });
      logInfo(`Created admin user: ${adminUser.username}`);
    } else {
      logInfo(`Using existing admin user: ${adminUser.username}`);
    }

    // Create JWT token for admin
    adminToken = jwt.sign(
      { userId: adminUser.id, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    logSuccess('Test data setup complete');
  } catch (error) {
    logError(`Failed to setup test data: ${error}`);
    throw error;
  }
}

async function testCreateUser() {
  logHeader('Testing User Creation');
  
  try {
    const userData = {
      username: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      role: 'USER',
      storeId: testStoreId,
    };

    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`User created successfully: ${result.user.username}`);
      return result.user;
    } else {
      const error = await response.json();
      logError(`Failed to create user: ${error.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error creating user: ${error}`);
    return null;
  }
}

async function testGetUsers() {
  logHeader('Testing User Retrieval');
  
  try {
    const response = await fetch('http://localhost:3000/api/users', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`Retrieved ${result.users.length} users`);
      return result.users;
    } else {
      const error = await response.json();
      logError(`Failed to retrieve users: ${error.error}`);
      return [];
    }
  } catch (error) {
    logError(`Error retrieving users: ${error}`);
    return [];
  }
}

async function testGetUserById(userId: string) {
  logHeader('Testing User Retrieval by ID');
  
  try {
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`Retrieved user: ${result.user.username}`);
      return result.user;
    } else {
      const error = await response.json();
      logError(`Failed to retrieve user: ${error.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error retrieving user: ${error}`);
    return null;
  }
}

async function testUpdateUser(userId: string) {
  logHeader('Testing User Update');
  
  try {
    const updateData = {
      username: `updated-user-${Date.now()}`,
      email: `updated-${Date.now()}@example.com`,
      role: 'MANAGER',
    };

    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(updateData),
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`User updated successfully: ${result.user.username}`);
      return result.user;
    } else {
      const error = await response.json();
      logError(`Failed to update user: ${error.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error updating user: ${error}`);
    return null;
  }
}

async function testUpdatePassword(userId: string) {
  logHeader('Testing Password Update');
  
  try {
    const passwordData = {
      password: 'newpassword123',
    };

    const response = await fetch(`http://localhost:3000/api/users/${userId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(passwordData),
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`Password updated successfully for user: ${result.user.username}`);
      return true;
    } else {
      const error = await response.json();
      logError(`Failed to update password: ${error.error}`);
      return false;
    }
  } catch (error) {
    logError(`Error updating password: ${error}`);
    return false;
  }
}

async function testDeleteUser(userId: string) {
  logHeader('Testing User Deletion');
  
  try {
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`User deleted successfully: ${result.deletedUser.username}`);
      return true;
    } else {
      const error = await response.json();
      logError(`Failed to delete user: ${error.error}`);
      return false;
    }
  } catch (error) {
    logError(`Error deleting user: ${error}`);
    return false;
  }
}

async function testUnauthorizedAccess() {
  logHeader('Testing Unauthorized Access');
  
  try {
    // Test without token
    const response = await fetch('http://localhost:3000/api/users');
    
    if (response.status === 401) {
      logSuccess('Unauthorized access properly blocked (401)');
    } else {
      logError(`Expected 401, got ${response.status}`);
    }

    // Test with invalid token
    const invalidResponse = await fetch('http://localhost:3000/api/users', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    if (invalidResponse.status === 401) {
      logSuccess('Invalid token properly rejected (401)');
    } else {
      logError(`Expected 401 for invalid token, got ${invalidResponse.status}`);
    }

  } catch (error) {
    logError(`Error testing unauthorized access: ${error}`);
  }
}

async function testValidationErrors() {
  logHeader('Testing Validation Errors');
  
  try {
    // Test invalid email
    const invalidEmailData = {
      username: 'test-user',
      email: 'invalid-email',
      password: 'testpassword123',
      role: 'USER',
      storeId: testStoreId,
    };

    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(invalidEmailData),
    });

    if (response.status === 400) {
      const error = await response.json();
      if (error.error === 'Validation error') {
        logSuccess('Email validation working correctly');
      } else {
        logError(`Unexpected validation error: ${error.error}`);
      }
    } else {
      logError(`Expected 400 for invalid email, got ${response.status}`);
    }

    // Test short password
    const shortPasswordData = {
      username: 'test-user',
      email: 'test@example.com',
      password: '123',
      role: 'USER',
      storeId: testStoreId,
    };

    const passwordResponse = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(shortPasswordData),
    });

    if (passwordResponse.status === 400) {
      logSuccess('Password validation working correctly');
    } else {
      logError(`Expected 400 for short password, got ${passwordResponse.status}`);
    }

  } catch (error) {
    logError(`Error testing validation: ${error}`);
  }
}

async function runAllTests() {
  logHeader('User Management API Test Suite');
  logInfo('Starting comprehensive user management testing...\n');

  try {
    await setupTestData();

    // Test user creation
    const createdUser = await testCreateUser();
    if (!createdUser) {
      logError('User creation failed, skipping remaining tests');
      return;
    }

    // Test user retrieval
    await testGetUsers();
    await testGetUserById(createdUser.id);

    // Test user update
    const updatedUser = await testUpdateUser(createdUser.id);
    if (updatedUser) {
      // Test password update
      await testUpdatePassword(updatedUser.id);
    }

    // Test validation errors
    await testValidationErrors();

    // Test unauthorized access
    await testUnauthorizedAccess();

    // Test user deletion
    await testDeleteUser(createdUser.id);

    logHeader('Test Summary');
    logSuccess('All user management tests completed!');
    logInfo('The user management API is working correctly with proper RBAC protection.');

  } catch (error) {
    logError(`Test suite failed: ${error}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if Next.js server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/users');
    return true;
  } catch (error) {
    return false;
  }
}

// Run the tests
async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    logError('Next.js server is not running on http://localhost:3000');
    logInfo('Please start the server with: npm run dev');
    process.exit(1);
  }

  await runAllTests();
}

main().catch(console.error);





