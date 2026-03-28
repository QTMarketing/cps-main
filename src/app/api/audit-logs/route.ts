/**
 * Audit Logs API Endpoint
 * 
 * This endpoint provides access to audit logs with comprehensive filtering
 * and pagination. Only ADMIN users can access audit logs for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, Role } from '@/lib/rbac';
import { 
  getAuditLogs, 
  getEntityAuditLogs, 
  getUserActivitySummary,
  getSystemActivitySummary,
  exportAuditLogsToCSV,
  AuditAction,
  EntityType 
} from '@/lib/audit-log';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const auditLogQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  userId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.nativeEnum(EntityType).optional(),
  entityId: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  ipAddress: z.string().optional(),
});

const entityAuditQuerySchema = z.object({
  entityType: z.nativeEnum(EntityType),
  entityId: z.string(),
});

const activitySummarySchema = z.object({
  userId: z.string().optional(),
  days: z.string().optional().transform(val => val ? parseInt(val) : 30),
});

// =============================================================================
// GET /api/audit-logs - Get audit logs with filtering
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Require ADMIN role for accessing audit logs
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validatedParams = auditLogQuerySchema.parse(queryParams);

    // Get audit logs
    const result = await getAuditLogs(validatedParams);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/audit-logs/entity - Get audit logs for specific entity
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Require ADMIN role
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      return response;
    }

    const body = await req.json();
    const validatedParams = entityAuditQuerySchema.parse(body);

    // Get entity audit logs
    const logs = await getEntityAuditLogs(
      validatedParams.entityType,
      validatedParams.entityId
    );

    return NextResponse.json({
      success: true,
      data: logs,
    });

  } catch (error) {
    console.error('Error fetching entity audit logs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch entity audit logs' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/audit-logs/summary - Get activity summary
// =============================================================================

export async function PUT(req: NextRequest) {
  try {
    // Require ADMIN role
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      return response;
    }

    const body = await req.json();
    const validatedParams = activitySummarySchema.parse(body);

    let summary;
    if (validatedParams.userId) {
      // Get user activity summary
      summary = await getUserActivitySummary(validatedParams.userId, validatedParams.days);
    } else {
      // Get system activity summary
      summary = await getSystemActivitySummary(validatedParams.days);
    }

    return NextResponse.json({
      success: true,
      data: summary,
    });

  } catch (error) {
    console.error('Error fetching activity summary:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch activity summary' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/audit-logs/export - Export audit logs to CSV
// =============================================================================

export async function PATCH(req: NextRequest) {
  try {
    // Require ADMIN role
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      return response;
    }

    const body = await req.json();
    const exportParams = z.object({
      userId: z.string().optional(),
      action: z.nativeEnum(AuditAction).optional(),
      entityType: z.nativeEnum(EntityType).optional(),
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    }).parse(body);

    // Export audit logs to CSV
    const csvData = await exportAuditLogsToCSV(exportParams);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `audit-logs-${timestamp}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting audit logs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}