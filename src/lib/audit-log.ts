/**
 * Comprehensive Audit Logging System
 * 
 * This module provides complete audit logging functionality for the QT Office
 * Check Printing System. It captures all financial operations, user actions,
 * and system changes with complete before/after state tracking.
 */

import { NextRequest } from 'next/server';
import { prisma } from './prisma';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export enum AuditAction {
  // Check Operations
  CREATE_CHECK = 'CREATE_CHECK',
  UPDATE_CHECK = 'UPDATE_CHECK',
  VOID_CHECK = 'VOID_CHECK',
  PRINT_CHECK = 'PRINT_CHECK',
  DELETE_CHECK = 'DELETE_CHECK',
  VIEW_CHECK = 'VIEW_CHECK',
  
  // User Operations
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  RESET_PASSWORD = 'RESET_PASSWORD',
  VIEW_USER = 'VIEW_USER',
  
  // Bank Operations
  CREATE_BANK = 'CREATE_BANK',
  UPDATE_BANK = 'UPDATE_BANK',
  DELETE_BANK = 'DELETE_BANK',
  UPDATE_BALANCE = 'UPDATE_BALANCE',
  VIEW_BANK = 'VIEW_BANK',
  
  // Vendor Operations
  CREATE_VENDOR = 'CREATE_VENDOR',
  UPDATE_VENDOR = 'UPDATE_VENDOR',
  DELETE_VENDOR = 'DELETE_VENDOR',
  VIEW_VENDOR = 'VIEW_VENDOR',
  
  // Store Operations
  CREATE_STORE = 'CREATE_STORE',
  UPDATE_STORE = 'UPDATE_STORE',
  DELETE_STORE = 'DELETE_STORE',
  VIEW_STORE = 'VIEW_STORE',
  
  // Authentication Operations
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REAUTH = 'REAUTH',
  FAILED_LOGIN = 'FAILED_LOGIN',
  
  // File Operations
  UPLOAD_FILE = 'UPLOAD_FILE',
  DELETE_FILE = 'DELETE_FILE',
  DOWNLOAD_FILE = 'DOWNLOAD_FILE',
  VIEW_FILE = 'VIEW_FILE',
  
  // Report Operations
  GENERATE_REPORT = 'GENERATE_REPORT',
  EXPORT_REPORT = 'EXPORT_REPORT',
  VIEW_REPORT = 'VIEW_REPORT',
  
  // System Operations
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

export enum EntityType {
  USER = 'USER',
  STORE = 'STORE',
  BANK = 'BANK',
  VENDOR = 'VENDOR',
  CHECK = 'CHECK',
  FILE = 'FILE',
  REPORT = 'REPORT',
  SYSTEM = 'SYSTEM',
}

export interface AuditLogData {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogResponse {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  user: {
    username: string;
    email: string;
    role: string;
  };
}

// =============================================================================
// AUDIT LOGGING FUNCTIONS
// =============================================================================

/**
 * Log an audit event to the database
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });

    console.log(`Audit logged: ${data.action} on ${data.entityType} by user ${data.userId}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw error to prevent breaking the main operation
  }
}

/**
 * Extract IP address and user agent from request
 */
export function extractRequestInfo(req: NextRequest): { ipAddress?: string; userAgent?: string } {
  const ipAddress = 
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Create audit middleware that automatically captures request info
 */
export function auditMiddleware() {
  return async (req: NextRequest, userId: string, action: AuditAction, entityType: EntityType, entityId?: string, changes?: { oldValues?: any; newValues?: any }) => {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    
    await logAudit({
      userId,
      action,
      entityType,
      entityId,
      oldValues: changes?.oldValues,
      newValues: changes?.newValues,
      ipAddress,
      userAgent,
    });
  };
}

// =============================================================================
// SPECIALIZED AUDIT FUNCTIONS
// =============================================================================

/**
 * Log check operations with complete financial state
 */
export async function logCheckOperation(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  checkId: string,
  oldCheck?: any,
  newCheck?: any,
  bankBalanceChange?: { oldBalance: number; newBalance: number }
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  const auditData: AuditLogData = {
    userId,
    action,
    entityType: EntityType.CHECK,
    entityId: checkId,
    oldValues: oldCheck,
    newValues: newCheck,
    ipAddress,
    userAgent,
  };

  // Include bank balance changes for financial operations
  if (bankBalanceChange) {
    auditData.metadata = {
      bankBalanceChange: {
        oldBalance: bankBalanceChange.oldBalance,
        newBalance: bankBalanceChange.newBalance,
        difference: bankBalanceChange.newBalance - bankBalanceChange.oldBalance,
      },
    };
  }

  await logAudit(auditData);
}

/**
 * Log bank operations with balance tracking
 */
export async function logBankOperation(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  bankId: string,
  oldBank?: any,
  newBank?: any
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logAudit({
    userId,
    action,
    entityType: EntityType.BANK,
    entityId: bankId,
    oldValues: oldBank,
    newValues: newBank,
    ipAddress,
    userAgent,
  });
}

/**
 * Log user operations with role and permission changes
 */
export async function logUserOperation(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  targetUserId: string,
  oldUser?: any,
  newUser?: any
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logAudit({
    userId,
    action,
    entityType: EntityType.USER,
    entityId: targetUserId,
    oldValues: oldUser,
    newValues: newUser,
    ipAddress,
    userAgent,
  });
}

/**
 * Log vendor operations
 */
export async function logVendorOperation(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  vendorId: string,
  oldVendor?: any,
  newVendor?: any
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logAudit({
    userId,
    action,
    entityType: EntityType.VENDOR,
    entityId: vendorId,
    oldValues: oldVendor,
    newValues: newVendor,
    ipAddress,
    userAgent,
  });
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  success: boolean,
  metadata?: Record<string, any>
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logAudit({
    userId,
    action,
    entityType: EntityType.USER,
    entityId: userId,
    oldValues: undefined,
    newValues: { success, ...metadata },
    ipAddress,
    userAgent,
  });
}

/**
 * Log file operations
 */
export async function logFileOperation(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  fileName: string,
  fileSize?: number,
  fileType?: string
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logAudit({
    userId,
    action,
    entityType: EntityType.FILE,
    entityId: fileName,
    oldValues: undefined,
    newValues: { fileName, fileSize, fileType },
    ipAddress,
    userAgent,
  });
}

/**
 * Log report operations
 */
export async function logReportOperation(
  req: NextRequest,
  userId: string,
  action: AuditAction,
  reportType: string,
  filters?: Record<string, any>,
  recordCount?: number
) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logAudit({
    userId,
    action,
    entityType: EntityType.REPORT,
    entityId: reportType,
    oldValues: undefined,
    newValues: { reportType, filters, recordCount },
    ipAddress,
    userAgent,
  });
}

// =============================================================================
// AUDIT QUERY FUNCTIONS
// =============================================================================

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
}) {
  const {
    page = 1,
    limit = 50,
    userId,
    action,
    entityType,
    entityId,
    startDate,
    endDate,
    ipAddress,
  } = params;

  const skip = (page - 1) * limit;

  const where: any = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (ipAddress) where.ipAddress = ipAddress;

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  const [auditLogs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take: limit,
      where,
      include: {
        user: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: auditLogs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(entityType: EntityType, entityId: string) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      user: {
        select: {
          username: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const activities = await prisma.auditLog.groupBy({
    by: ['action', 'entityType'],
    where: {
      userId,
      createdAt: {
        gte: startDate,
      },
    },
    _count: {
      id: true,
    },
  });

  return activities.map(activity => ({
    action: activity.action,
    entityType: activity.entityType,
    count: activity._count.id,
  }));
}

/**
 * Get system activity summary
 */
export async function getSystemActivitySummary(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const activities = await prisma.auditLog.groupBy({
    by: ['action', 'entityType'],
    where: {
      createdAt: {
        gte: startDate,
      },
    },
    _count: {
      id: true,
    },
  });

  return activities.map(activity => ({
    action: activity.action,
    entityType: activity.entityType,
    count: activity._count.id,
  }));
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clean up old audit logs (retention policy)
 */
export async function cleanupOldAuditLogs(retentionDays: number = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`Cleaned up ${result.count} old audit logs`);
  return result.count;
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogsToCSV(params: {
  userId?: string;
  action?: AuditAction;
  entityType?: EntityType;
  startDate?: Date;
  endDate?: Date;
}) {
  const logs = await getAuditLogs({ ...params, limit: 10000 });
  
  const csvHeaders = [
    'Timestamp',
    'User',
    'Action',
    'Entity Type',
    'Entity ID',
    'IP Address',
    'User Agent',
  ];

  const csvRows = logs.data.map(log => [
    log.createdAt.toISOString(),
    log.user.username,
    log.action,
    log.entityType,
    log.entityId || '',
    log.ipAddress || '',
    log.userAgent || '',
  ]);

  return [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
}


