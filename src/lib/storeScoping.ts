/**
 * Store-Scoped Access Control Utilities (1:1 User-Store Model)
 * 
 * This module provides helper functions for enforcing store-scoped access control.
 * Each user is assigned to one store (nullable for SUPER_ADMIN).
 * Non-admin users can only access data from their assigned store.
 * SUPER_ADMIN has unrestricted access to all stores.
 */

import { Role } from './roles';

export interface StoreScopingContext {
  role: Role;
  storeId: number | null;
}

/**
 * Build Prisma where clause with store filtering
 * Returns filter for user's store, or {} for SUPER_ADMIN
 * 
 * @param context - User's role and assigned store ID
 * @returns Prisma where clause fragment
 */
export function scopeWhere(context: StoreScopingContext): any {
  // SUPER_ADMIN sees everything - no filtering
  if (context.role === 'SUPER_ADMIN') {
    return {};
  }
  
  // User with no store - return impossible condition
  if (context.storeId === null) {
    return { id: -1 }; // No records will match
  }
  
  // Return filter for user's assigned store
  return { store_id: context.storeId };
}

/**
 * Verify user has access to a specific store
 * 
 * @param storeId - Store ID to check access for
 * @param context - User's role and assigned store ID
 * @returns True if user has access, false otherwise
 */
export function verifyStoreAccess(
  storeId: number,
  context: StoreScopingContext
): boolean {
  // SUPER_ADMIN has access to all stores
  if (context.role === 'SUPER_ADMIN') {
    return true;
  }
  
  // Check if storeId matches user's assigned store
  return context.storeId === storeId;
}

/**
 * Get user's allowed store ID
 * Returns null for SUPER_ADMIN (all stores), or the user's storeId
 * 
 * @param context - User's role and assigned store ID
 * @returns Store ID or null for unrestricted access
 */
export function getAllowedStoreId(
  context: StoreScopingContext
): number | null {
  if (context.role === 'SUPER_ADMIN') {
    return null; // All stores allowed
  }
  return context.storeId;
}

/**
 * Helper to get auth context from request
 * Extracts role and storeId for use in scoping functions
 */
export function getAuthContext(auth: { role: Role; storeId?: number | null }): StoreScopingContext {
  return {
    role: auth.role,
    storeId: auth.storeId ?? null,
  };
}
