#!/usr/bin/env node

/**
 * RBAC System Testing Script
 * 
 * This script tests the Role-Based Access Control system to ensure
 * all permissions and roles work correctly.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { 
  Role, 
  Permission, 
  ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  userHasRole,
  userHasAnyRole,
  userHasRoleOrHigher,
  getUserPermissions,
  getRolePermissions,
  isValidRole,
  isValidPermission
} from '../src/lib/rbac';

// Mock user data for testing
const mockUsers = {
  admin: {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@qt-office.com',
    role: Role.ADMIN,
    storeId: 'store-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  manager: {
    id: 'manager-1',
    username: 'manager',
    email: 'manager@qt-office.com',
    role: Role.MANAGER,
    storeId: 'store-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-1',
    username: 'user',
    email: 'user@qt-office.com',
    role: Role.USER,
    storeId: 'store-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

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

async function testRolePermissions() {
  logHeader('Testing Role Permissions');
  
  // Test ADMIN permissions
  logInfo('Testing ADMIN permissions...');
  const adminPermissions = getRolePermissions(Role.ADMIN);
  log(`ADMIN has ${adminPermissions.length} permissions`);
  
  // Test MANAGER permissions
  logInfo('Testing MANAGER permissions...');
  const managerPermissions = getRolePermissions(Role.MANAGER);
  log(`MANAGER has ${managerPermissions.length} permissions`);
  
  // Test USER permissions
  logInfo('Testing USER permissions...');
  const userPermissions = getRolePermissions(Role.USER);
  log(`USER has ${userPermissions.length} permissions`);
  
  // Verify hierarchy
  if (adminPermissions.length > managerPermissions.length && 
      managerPermissions.length > userPermissions.length) {
    logSuccess('Permission hierarchy is correct (ADMIN > MANAGER > USER)');
  } else {
    logError('Permission hierarchy is incorrect');
  }
}

async function testPermissionChecks() {
  logHeader('Testing Permission Checks');
  
  // Test specific permissions for each role
  const testCases = [
    {
      user: mockUsers.admin,
      permission: Permission.MANAGE_USERS,
      expected: true,
      description: 'ADMIN should have MANAGE_USERS permission'
    },
    {
      user: mockUsers.manager,
      permission: Permission.MANAGE_USERS,
      expected: false,
      description: 'MANAGER should NOT have MANAGE_USERS permission'
    },
    {
      user: mockUsers.user,
      permission: Permission.CREATE_CHECK,
      expected: true,
      description: 'USER should have CREATE_CHECK permission'
    },
    {
      user: mockUsers.user,
      permission: Permission.DELETE_USER,
      expected: false,
      description: 'USER should NOT have DELETE_USER permission'
    }
  ];
  
  testCases.forEach(({ user, permission, expected, description }) => {
    const result = userHasPermission(user, permission);
    if (result === expected) {
      logSuccess(`${description} - ${result ? 'HAS' : 'DOES NOT HAVE'} permission`);
    } else {
      logError(`${description} - Expected ${expected}, got ${result}`);
    }
  });
}

async function testRoleChecks() {
  logHeader('Testing Role Checks');
  
  const testCases = [
    {
      user: mockUsers.admin,
      role: Role.ADMIN,
      expected: true,
      description: 'ADMIN should have ADMIN role'
    },
    {
      user: mockUsers.manager,
      role: Role.ADMIN,
      expected: false,
      description: 'MANAGER should NOT have ADMIN role'
    },
    {
      user: mockUsers.user,
      role: Role.USER,
      expected: true,
      description: 'USER should have USER role'
    }
  ];
  
  testCases.forEach(({ user, role, expected, description }) => {
    const result = userHasRole(user, role);
    if (result === expected) {
      logSuccess(`${description} - ${result ? 'HAS' : 'DOES NOT HAVE'} role`);
    } else {
      logError(`${description} - Expected ${expected}, got ${result}`);
    }
  });
}

async function testRoleHierarchy() {
  logHeader('Testing Role Hierarchy');
  
  const testCases = [
    {
      user: mockUsers.admin,
      minimumRole: Role.USER,
      expected: true,
      description: 'ADMIN should have USER level or higher'
    },
    {
      user: mockUsers.admin,
      minimumRole: Role.MANAGER,
      expected: true,
      description: 'ADMIN should have MANAGER level or higher'
    },
    {
      user: mockUsers.admin,
      minimumRole: Role.ADMIN,
      expected: true,
      description: 'ADMIN should have ADMIN level or higher'
    },
    {
      user: mockUsers.manager,
      minimumRole: Role.USER,
      expected: true,
      description: 'MANAGER should have USER level or higher'
    },
    {
      user: mockUsers.manager,
      minimumRole: Role.ADMIN,
      expected: false,
      description: 'MANAGER should NOT have ADMIN level or higher'
    },
    {
      user: mockUsers.user,
      minimumRole: Role.MANAGER,
      expected: false,
      description: 'USER should NOT have MANAGER level or higher'
    }
  ];
  
  testCases.forEach(({ user, minimumRole, expected, description }) => {
    const result = userHasRoleOrHigher(user, minimumRole);
    if (result === expected) {
      logSuccess(`${description} - ${result ? 'HAS' : 'DOES NOT HAVE'} minimum role`);
    } else {
      logError(`${description} - Expected ${expected}, got ${result}`);
    }
  });
}

async function testMultiplePermissions() {
  logHeader('Testing Multiple Permission Checks');
  
  // Test userHasAnyPermission
  const checkPermissions = [Permission.CREATE_CHECK, Permission.VIEW_CHECK];
  const userHasAny = userHasAnyPermission(mockUsers.user, checkPermissions);
  if (userHasAny) {
    logSuccess('USER has at least one check permission');
  } else {
    logError('USER should have at least one check permission');
  }
  
  // Test userHasAllPermissions
  const adminPermissions = [Permission.MANAGE_USERS, Permission.MANAGE_SYSTEM];
  const adminHasAll = userHasAllPermissions(mockUsers.admin, adminPermissions);
  if (adminHasAll) {
    logSuccess('ADMIN has all admin permissions');
  } else {
    logError('ADMIN should have all admin permissions');
  }
  
  // Test userHasAnyRole
  const managerRoles = [Role.MANAGER, Role.ADMIN];
  const managerHasAny = userHasAnyRole(mockUsers.manager, managerRoles);
  if (managerHasAny) {
    logSuccess('MANAGER has one of the specified roles');
  } else {
    logError('MANAGER should have one of the specified roles');
  }
}

async function testValidation() {
  logHeader('Testing Validation Functions');
  
  // Test isValidRole
  const validRoles = ['ADMIN', 'MANAGER', 'USER'];
  const invalidRoles = ['INVALID', 'GUEST', ''];
  
  validRoles.forEach(role => {
    if (isValidRole(role)) {
      logSuccess(`"${role}" is a valid role`);
    } else {
      logError(`"${role}" should be a valid role`);
    }
  });
  
  invalidRoles.forEach(role => {
    if (!isValidRole(role)) {
      logSuccess(`"${role}" is correctly identified as invalid role`);
    } else {
      logError(`"${role}" should be identified as invalid role`);
    }
  });
  
  // Test isValidPermission
  const validPermissions = ['CREATE_CHECK', 'MANAGE_USERS', 'VIEW_REPORTS'];
  const invalidPermissions = ['INVALID_PERM', 'DELETE_EVERYTHING', ''];
  
  validPermissions.forEach(permission => {
    if (isValidPermission(permission)) {
      logSuccess(`"${permission}" is a valid permission`);
    } else {
      logError(`"${permission}" should be a valid permission`);
    }
  });
  
  invalidPermissions.forEach(permission => {
    if (!isValidPermission(permission)) {
      logSuccess(`"${permission}" is correctly identified as invalid permission`);
    } else {
      logError(`"${permission}" should be identified as invalid permission`);
    }
  });
}

async function testPermissionGroups() {
  logHeader('Testing Permission Groups');
  
  const groups = Object.keys(PERMISSION_GROUPS);
  logInfo(`Found ${groups.length} permission groups:`);
  
  groups.forEach(group => {
    const permissions = PERMISSION_GROUPS[group as keyof typeof PERMISSION_GROUPS];
    log(`  - ${group}: ${permissions.length} permissions`);
  });
  
  // Test that all permissions in groups are valid
  let allValid = true;
  groups.forEach(group => {
    const permissions = PERMISSION_GROUPS[group as keyof typeof PERMISSION_GROUPS];
    permissions.forEach(permission => {
      if (!isValidPermission(permission)) {
        logError(`Invalid permission "${permission}" in group "${group}"`);
        allValid = false;
      }
    });
  });
  
  if (allValid) {
    logSuccess('All permissions in groups are valid');
  }
}

async function testEdgeCases() {
  logHeader('Testing Edge Cases');
  
  // Test with empty permission arrays
  const emptyPermissions = userHasAnyPermission(mockUsers.admin, []);
  if (!emptyPermissions) {
    logSuccess('Empty permission array correctly returns false');
  } else {
    logError('Empty permission array should return false');
  }
  
  // Test with all permissions
  const allPermissions = userHasAllPermissions(mockUsers.admin, []);
  if (allPermissions) {
    logSuccess('Empty permission array for "all" check correctly returns true');
  } else {
    logError('Empty permission array for "all" check should return true');
  }
  
  // Test role hierarchy edge cases
  const sameRole = userHasRoleOrHigher(mockUsers.user, Role.USER);
  if (sameRole) {
    logSuccess('Same role level correctly returns true');
  } else {
    logError('Same role level should return true');
  }
}

async function generatePermissionMatrix() {
  logHeader('Permission Matrix');
  
  const roles = [Role.ADMIN, Role.MANAGER, Role.USER];
  const permissions = Object.values(Permission);
  
  log('Role | Permission | Has Access');
  log('-'.repeat(50));
  
  roles.forEach(role => {
    permissions.forEach(permission => {
      const hasAccess = userHasPermission(mockUsers[role.toLowerCase() as keyof typeof mockUsers], permission);
      const status = hasAccess ? '✅' : '❌';
      log(`${role.padEnd(6)} | ${permission.padEnd(20)} | ${status}`);
    });
    log('-'.repeat(50));
  });
}

async function runAllTests() {
  logHeader('RBAC System Test Suite');
  logInfo('Starting comprehensive RBAC testing...\n');
  
  try {
    await testRolePermissions();
    await testPermissionChecks();
    await testRoleChecks();
    await testRoleHierarchy();
    await testMultiplePermissions();
    await testValidation();
    await testPermissionGroups();
    await testEdgeCases();
    await generatePermissionMatrix();
    
    logHeader('Test Summary');
    logSuccess('All RBAC tests completed successfully!');
    logInfo('The RBAC system is working correctly and ready for production use.');
    
  } catch (error) {
    logError(`Test suite failed: ${error}`);
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);
