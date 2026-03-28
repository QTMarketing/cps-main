/**
 * Role-Based Access Control (RBAC) System
 * 
 * This module provides comprehensive role-based access control for the QT Office
 * Check Printing System. It includes role definitions, permission management,
 * middleware functions, and helper utilities.
 * 
 * Features:
 * - Role hierarchy (SUPER_ADMIN > ADMIN > USER)
 * - Permission-based access control
 * - Middleware for API route protection
 * - TypeScript type safety
 * - Comprehensive permission checking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { Role } from './roles';

// Re-export Role for backward compatibility
export { Role } from './roles';

// =============================================================================
// PERMISSION DEFINITIONS
// =============================================================================

export enum Permission {
  // Check Management
  CREATE_CHECK = 'CREATE_CHECK',
  VIEW_CHECK = 'VIEW_CHECK',
  EDIT_CHECK = 'EDIT_CHECK',
  VOID_CHECK = 'VOID_CHECK',
  PRINT_CHECK = 'PRINT_CHECK',
  
  // User Management
  MANAGE_USERS = 'MANAGE_USERS',
  VIEW_USERS = 'VIEW_USERS',
  CREATE_USER = 'CREATE_USER',
  EDIT_USER = 'EDIT_USER',
  DELETE_USER = 'DELETE_USER',
  
  // Vendor Management
  MANAGE_VENDORS = 'MANAGE_VENDORS',
  VIEW_VENDORS = 'VIEW_VENDORS',
  CREATE_VENDOR = 'CREATE_VENDOR',
  EDIT_VENDOR = 'EDIT_VENDOR',
  DELETE_VENDOR = 'DELETE_VENDOR',
  
  // Bank Management
  MANAGE_BANKS = 'MANAGE_BANKS',
  VIEW_BANKS = 'VIEW_BANKS',
  CREATE_BANK = 'CREATE_BANK',
  EDIT_BANK = 'EDIT_BANK',
  DELETE_BANK = 'DELETE_BANK',
  
  // Reports
  VIEW_REPORTS = 'VIEW_REPORTS',
  EXPORT_REPORTS = 'EXPORT_REPORTS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  
  // System Administration
  MANAGE_SYSTEM = 'MANAGE_SYSTEM',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
  
  // File Management
  UPLOAD_FILES = 'UPLOAD_FILES',
  DOWNLOAD_FILES = 'DOWNLOAD_FILES',
  DELETE_FILES = 'DELETE_FILES',
}

// =============================================================================
// PERMISSION HIERARCHY
// =============================================================================

/**
 * Permission hierarchy mapping roles to their allowed permissions
 * ADMIN has nearly all permissions, USER has limited access
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // Super Admin inherits everything Admin can do plus system permissions.
    Permission.CREATE_CHECK,
    Permission.VIEW_CHECK,
    Permission.EDIT_CHECK,
    Permission.VOID_CHECK,
    Permission.PRINT_CHECK,
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.EDIT_USER,
    Permission.DELETE_USER,
    Permission.MANAGE_VENDORS,
    Permission.VIEW_VENDORS,
    Permission.CREATE_VENDOR,
    Permission.EDIT_VENDOR,
    Permission.DELETE_VENDOR,
    Permission.MANAGE_BANKS,
    Permission.VIEW_BANKS,
    Permission.CREATE_BANK,
    Permission.EDIT_BANK,
    Permission.DELETE_BANK,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SYSTEM,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_SETTINGS,
    Permission.UPLOAD_FILES,
    Permission.DOWNLOAD_FILES,
    Permission.DELETE_FILES,
  ],

  [Role.ADMIN]: [
    // All operational permissions except system-level
    Permission.CREATE_CHECK,
    Permission.VIEW_CHECK,
    Permission.EDIT_CHECK,
    Permission.VOID_CHECK,
    Permission.PRINT_CHECK,
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.EDIT_USER,
    Permission.DELETE_USER,
    Permission.MANAGE_VENDORS,
    Permission.VIEW_VENDORS,
    Permission.CREATE_VENDOR,
    Permission.EDIT_VENDOR,
    Permission.DELETE_VENDOR,
    Permission.MANAGE_BANKS,
    Permission.VIEW_BANKS,
    Permission.CREATE_BANK,
    Permission.EDIT_BANK,
    Permission.DELETE_BANK,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SYSTEM,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_SETTINGS,
    Permission.UPLOAD_FILES,
    Permission.DOWNLOAD_FILES,
    Permission.DELETE_FILES,
  ],

  [Role.OFFICE_ADMIN]: [
    Permission.CREATE_CHECK,
    Permission.VIEW_CHECK,
    Permission.PRINT_CHECK,
    Permission.VIEW_REPORTS,
    Permission.CREATE_VENDOR,
    Permission.VIEW_VENDORS,
  ],

  // View-only reporting role (intended for Back Office team)
  [Role.BACK_OFFICE]: [
    Permission.VIEW_REPORTS,
    Permission.VIEW_CHECK,
  ],

  [Role.STORE_USER]: [
    Permission.CREATE_CHECK,
    Permission.VIEW_CHECK,
    Permission.EDIT_CHECK,
    Permission.PRINT_CHECK,
    Permission.VIEW_REPORTS,
    Permission.VIEW_VENDORS,
    Permission.VIEW_BANKS,
    Permission.UPLOAD_FILES,
    Permission.DOWNLOAD_FILES,
  ],
  
  [Role.USER]: [
    // Limited permissions for basic operations
    Permission.CREATE_CHECK,
    Permission.VIEW_CHECK,
    Permission.EDIT_CHECK,
    Permission.PRINT_CHECK,
    Permission.VIEW_VENDORS,
    Permission.VIEW_BANKS,
    Permission.VIEW_REPORTS,
    Permission.UPLOAD_FILES,
    Permission.DOWNLOAD_FILES,
  ],
};

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

export interface User {
  id: string;
  username: string;
  role: Role;
  email?: string | null;
  storeId?: number | null; // Direct 1:1 store assignment
  assignedBankId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermissionCheck {
  user: User;
  permission: Permission;
  hasPermission: boolean;
}

export interface RoleCheck {
  user: User;
  role: Role;
  hasRole: boolean;
}

export interface RBACContext {
  user: User;
  permissions: Permission[];
  role: Role;
}

export interface RBACError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_ROLE' | 'INVALID_PERMISSION';
  message: string;
  details?: any;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all permissions for a given role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a user has a specific permission
 */
export function userHasPermission(user: User, permission: Permission): boolean {
  const userPermissions = getRolePermissions(user.role);
  return userPermissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function userHasAnyPermission(user: User, permissions: Permission[]): boolean {
  return permissions.some(permission => userHasPermission(user, permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function userHasAllPermissions(user: User, permissions: Permission[]): boolean {
  return permissions.every(permission => userHasPermission(user, permission));
}

/**
 * Check if a user has a specific role
 */
export function userHasRole(user: User, role: Role): boolean {
  return user.role === role;
}

/**
 * Check if a user has any of the specified roles
 */
export function userHasAnyRole(user: User, roles: Role[]): boolean {
  return roles.includes(user.role);
}

/**
 * Check if a user's role is higher than or equal to the specified role
 */
export function userHasRoleOrHigher(user: User, minimumRole: Role): boolean {
  const roleHierarchy = [Role.USER, Role.ADMIN, Role.SUPER_ADMIN];
  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);
  
  return userRoleIndex >= minimumRoleIndex;
}

/**
 * Get user's effective permissions (including inherited permissions)
 */
export function getUserPermissions(user: User): Permission[] {
  return getRolePermissions(user.role);
}

/**
 * Validate if a role exists
 */
export function isValidRole(role: string): role is Role {
  return Object.values(Role).includes(role as Role);
}

/**
 * Validate if a permission exists
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(Permission).includes(permission as Permission);
}

// =============================================================================
// MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * Middleware to require a specific permission
 * Returns 403 Forbidden if user doesn't have the permission
 */
export function requirePermission(permission: Permission) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      // Get user from request: Authorization header or auth-token cookie
      const authHeader = req.headers.get('authorization');
      let token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : '';

      if (!token) {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.split('; ').find((c) => c.startsWith('auth-token='));
        if (match) token = match.split('=')[1] || '';
      }

      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'No valid authentication token' },
          { status: 401 }
        );
      }
      
      // Verify JWT token and get user
      const user = await getUserFromToken(token);
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid authentication token' },
          { status: 401 }
        );
      }

      // Check if user has the required permission
      if (!userHasPermission(user, permission)) {
        return NextResponse.json(
          { 
            error: 'Forbidden', 
            message: `Insufficient permissions. Required: ${permission}`,
            userRole: user.role,
            requiredPermission: permission
          },
          { status: 403 }
        );
      }

      // Add user to request headers for downstream handlers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-role', user.role);
      requestHeaders.set('x-user-permissions', JSON.stringify(getUserPermissions(user)));

      // Return null to indicate middleware passed
      return null;
    } catch (error) {
      console.error('Permission check error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Permission check failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to require a specific role
 * Returns 403 Forbidden if user doesn't have the role
 */
export function requireRole(role: Role) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      // Get user from request: Authorization header or auth-token cookie
      const authHeader = req.headers.get('authorization');
      let token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : '';

      if (!token) {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.split('; ').find((c) => c.startsWith('auth-token='));
        if (match) token = match.split('=')[1] || '';
      }

      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'No valid authentication token' },
          { status: 401 }
        );
      }
      const user = await getUserFromToken(token);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid authentication token' },
          { status: 401 }
        );
      }

      // Check if user has the required role (or higher)
      if (!userHasRoleOrHigher(user, role)) {
        return NextResponse.json(
          { 
            error: 'Forbidden', 
            message: `Insufficient role. Required: ${role}, userRole: ${user.role}`,
            userRole: user.role,
            requiredRole: role
          },
          { status: 403 }
        );
      }

      // Add user to request headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-role', user.role);
      requestHeaders.set('x-user-permissions', JSON.stringify(getUserPermissions(user)));

      // Return null to indicate middleware passed
      return null;
    } catch (error) {
      console.error('Role check error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Role check failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to require a minimum role level
 * Returns 403 Forbidden if user's role is below the minimum
 */
export function requireMinimumRole(minimumRole: Role) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      const authHeader = req.headers.get('authorization');
      let token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : '';

      if (!token) {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.split('; ').find((c) => c.startsWith('auth-token='));
        if (match) token = match.split('=')[1] || '';
      }

      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'No valid authentication token' },
          { status: 401 }
        );
      }
      const user = await getUserFromToken(token);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid authentication token' },
          { status: 401 }
        );
      }

      // Check if user has minimum role level
      if (!userHasRoleOrHigher(user, minimumRole)) {
        return NextResponse.json(
          { 
            error: 'Forbidden', 
            message: `Insufficient role level. Required: ${minimumRole} or higher`,
            userRole: user.role,
            minimumRole: minimumRole
          },
          { status: 403 }
        );
      }

      // Add user to request headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-role', user.role);
      requestHeaders.set('x-user-permissions', JSON.stringify(getUserPermissions(user)));

      // Return null to indicate middleware passed
      return null;
    } catch (error) {
      console.error('Minimum role check error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Role level check failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to require any of the specified permissions
 * Returns 403 Forbidden if user doesn't have any of the permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      const authHeader = req.headers.get('authorization');
      let token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : '';

      if (!token) {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.split('; ').find((c) => c.startsWith('auth-token='));
        if (match) token = match.split('=')[1] || '';
      }

      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'No valid authentication token' },
          { status: 401 }
        );
      }
      const user = await getUserFromToken(token);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid authentication token' },
          { status: 401 }
        );
      }

      // Check if user has any of the required permissions
      if (!userHasAnyPermission(user, permissions)) {
        return NextResponse.json(
          { 
            error: 'Forbidden', 
            message: `Insufficient permissions. Required any of: ${permissions.join(', ')}`,
            userRole: user.role,
            requiredPermissions: permissions
          },
          { status: 403 }
        );
      }

      // Add user to request headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-role', user.role);
      requestHeaders.set('x-user-permissions', JSON.stringify(getUserPermissions(user)));

      // Return null to indicate middleware passed
      return null;
    } catch (error) {
      console.error('Any permission check error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Permission check failed' },
        { status: 500 }
      );
    }
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get user from JWT token
 * This function should be implemented based on your JWT verification logic
 */
async function getUserFromToken(token: string): Promise<User | null> {
  try {
    // Import JWT verification (you'll need to implement this based on your JWT setup)
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production') as {
      userId?: number;
      role?: Role;
    };

    if (!decoded || typeof decoded.userId !== 'number') {
      return null;
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        role: true,
        assigned_bank_id: true,
        store_id: true,
        created_at: true,
      },
    });

    if (!userRecord) {
      return null;
    }

    // ALWAYS use role from database (source of truth), not from token
    // Token may be stale if user's role was changed after login
    const role = (userRecord.role as Role | undefined) ?? Role.USER;
    
    // Temporary debug logging
    console.log('[RBAC getUserFromToken]', {
      userId: userRecord.id,
      username: userRecord.username,
      roleFromDB: userRecord.role,
      roleFromToken: decoded.role,
      finalRole: role,
      storeId: userRecord.store_id,
    });

    return {
      id: String(userRecord.id),
      username: userRecord.username,
      role,
      storeId: userRecord.store_id,
      assignedBankId: userRecord.assigned_bank_id ? String(userRecord.assigned_bank_id) : null,
      createdAt: userRecord.created_at,
      updatedAt: userRecord.created_at,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Get user from request headers (set by middleware)
 */
export function getUserFromRequest(req: NextRequest): User | null {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');
  
  if (!userId || !userRole) {
    return null;
  }
  
  return {
    id: userId,
    role: userRole as Role,
    username: '',
    email: '',
    storeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create RBAC context from request
 */
export function createRBACContext(req: NextRequest): RBACContext | null {
  const user = getUserFromRequest(req);
  if (!user) {
    return null;
  }
  
  const permissions = JSON.parse(req.headers.get('x-user-permissions') || '[]');
  
  return {
    user,
    permissions,
    role: user.role,
  };
}

// =============================================================================
// PERMISSION CONSTANTS FOR COMMON USE CASES
// =============================================================================

export const PERMISSION_GROUPS = {
  CHECK_MANAGEMENT: [
    Permission.CREATE_CHECK,
    Permission.VIEW_CHECK,
    Permission.EDIT_CHECK,
    Permission.VOID_CHECK,
    Permission.PRINT_CHECK,
  ],
  
  USER_MANAGEMENT: [
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.EDIT_USER,
    Permission.DELETE_USER,
  ],
  
  VENDOR_MANAGEMENT: [
    Permission.MANAGE_VENDORS,
    Permission.VIEW_VENDORS,
    Permission.CREATE_VENDOR,
    Permission.EDIT_VENDOR,
    Permission.DELETE_VENDOR,
  ],
  
  BANK_MANAGEMENT: [
    Permission.MANAGE_BANKS,
    Permission.VIEW_BANKS,
    Permission.CREATE_BANK,
    Permission.EDIT_BANK,
    Permission.DELETE_BANK,
  ],
  
  REPORTING: [
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_ANALYTICS,
  ],
  
  SYSTEM_ADMINISTRATION: [
    Permission.MANAGE_SYSTEM,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_SETTINGS,
  ],
  
  FILE_MANAGEMENT: [
    Permission.UPLOAD_FILES,
    Permission.DOWNLOAD_FILES,
    Permission.DELETE_FILES,
  ],
};

// =============================================================================
// EXPORT ALL TYPES AND FUNCTIONS
// =============================================================================

export default {
  Role,
  Permission,
  ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  requirePermission,
  requireRole,
  requireMinimumRole,
  requireAnyPermission,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  userHasRole,
  userHasAnyRole,
  userHasRoleOrHigher,
  getUserPermissions,
  getRolePermissions,
  isValidRole,
  isValidPermission,
  getUserFromRequest,
  createRBACContext,
};
