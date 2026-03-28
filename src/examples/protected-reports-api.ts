/**
 * Protected API Routes Examples - Reports Management
 * 
 * This file demonstrates how to implement RBAC-protected API routes
 * for reports and analytics operations using the RBAC middleware system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, Permission } from '@/lib/rbac';
import { z } from 'zod';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  paymentMethod?: string;
  vendorId?: string;
  bankId?: string;
  userId?: string;
}

interface ReportResponse {
  summary: {
    totalChecks: number;
    totalAmount: number;
    averageAmount: number;
    statusBreakdown: Record<string, number>;
    paymentMethodBreakdown: Record<string, number>;
  };
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const reportFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['PENDING', 'CLEARED', 'VOIDED']).optional(),
  paymentMethod: z.enum(['CHECK', 'EDI', 'MO', 'CASH']).optional(),
  vendorId: z.string().optional(),
  bankId: z.string().optional(),
  userId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// =============================================================================
// GET /api/reports - Generate Reports (VIEW_REPORTS permission required)
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Check VIEW_REPORTS permission
    const permissionCheck = requirePermission(Permission.VIEW_REPORTS);
    const response = await permissionCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized reports access attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const filters = reportFiltersSchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      status: searchParams.get('status'),
      paymentMethod: searchParams.get('paymentMethod'),
      vendorId: searchParams.get('vendorId'),
      bankId: searchParams.get('bankId'),
      userId: searchParams.get('userId'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const page = parseInt(filters.page || '1');
    const limit = parseInt(filters.limit || '50');
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters.bankId) {
      where.bankId = filters.bankId;
    }

    if (filters.userId) {
      where.issuedBy = filters.userId;
    }

    // Get checks with pagination
    const checks = await prisma.check.findMany({
      skip,
      take: limit,
      where,
      include: {
        vendor: {
          select: { vendorName: true },
        },
        bank: {
          select: { bankName: true },
        },
        issuedByUser: {
          select: { username: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get total count for pagination
    const totalChecks = await prisma.check.count({ where });

    // Calculate summary statistics
    const summaryData = await prisma.check.aggregate({
      where,
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
    });

    // Get status breakdown
    const statusBreakdown = await prisma.check.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    // Get payment method breakdown
    const paymentMethodBreakdown = await prisma.check.groupBy({
      by: ['paymentMethod'],
      where,
      _count: {
        id: true,
      },
    });

    // Format summary data
    const summary = {
      totalChecks: summaryData._count.id || 0,
      totalAmount: summaryData._sum.amount || 0,
      averageAmount: summaryData._avg.amount || 0,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      paymentMethodBreakdown: paymentMethodBreakdown.reduce((acc, item) => {
        acc[item.paymentMethod] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    };

    // Log successful report generation
    console.log(`Report generated successfully with ${totalChecks} checks`);

    const reportResponse: ReportResponse = {
      summary,
      data: checks,
      pagination: {
        page,
        limit,
        total: totalChecks,
        totalPages: Math.ceil(totalChecks / limit),
      },
    };

    return NextResponse.json(reportResponse);

  } catch (error) {
    console.error('Error generating report:', error);

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
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/reports/export - Export Reports (EXPORT_REPORTS permission required)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Check EXPORT_REPORTS permission
    const permissionCheck = requirePermission(Permission.EXPORT_REPORTS);
    const response = await permissionCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized report export attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const body = await req.json();
    const { format, filters } = z.object({
      format: z.enum(['CSV', 'PDF', 'EXCEL']),
      filters: reportFiltersSchema.optional(),
    }).parse(body);

    // Build where clause for filtering (same as GET)
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters?.bankId) {
      where.bankId = filters.bankId;
    }

    if (filters?.userId) {
      where.issuedBy = filters.userId;
    }

    // Get all checks for export (no pagination)
    const checks = await prisma.check.findMany({
      where,
      include: {
        vendor: {
          select: { vendorName: true },
        },
        bank: {
          select: { bankName: true },
        },
        issuedByUser: {
          select: { username: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Generate export based on format
    let exportData: any;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'CSV':
        exportData = generateCSV(checks);
        contentType = 'text/csv';
        filename = `checks-report-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      
      case 'PDF':
        exportData = generatePDF(checks);
        contentType = 'application/pdf';
        filename = `checks-report-${new Date().toISOString().split('T')[0]}.pdf`;
        break;
      
      case 'EXCEL':
        exportData = generateExcel(checks);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `checks-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        );
    }

    // Log successful export
    console.log(`Report exported successfully in ${format} format with ${checks.length} records`);

    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting report:', error);

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
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR EXPORT
// =============================================================================

function generateCSV(checks: any[]): string {
  const headers = [
    'Check Number',
    'Date',
    'Payee',
    'Amount',
    'Payment Method',
    'Status',
    'Memo',
    'Bank',
    'Issued By',
  ];

  const rows = checks.map(check => [
    check.checkNumber,
    check.createdAt.toISOString().split('T')[0],
    check.vendor.vendorName,
    check.amount.toFixed(2),
    check.paymentMethod,
    check.status,
    check.memo || '',
    check.bank.bankName,
    check.issuedByUser.username,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}

function generatePDF(checks: any[]): Buffer {
  // This is a simplified example - in production, you'd use a proper PDF library
  const pdfContent = `PDF Report - ${checks.length} checks\n\n` +
    checks.map(check => 
      `${check.checkNumber} - ${check.vendor.vendorName} - $${check.amount.toFixed(2)}`
    ).join('\n');
  
  return Buffer.from(pdfContent);
}

function generateExcel(checks: any[]): Buffer {
  // This is a simplified example - in production, you'd use a proper Excel library
  const excelContent = `Excel Report - ${checks.length} checks\n\n` +
    checks.map(check => 
      `${check.checkNumber}\t${check.vendor.vendorName}\t${check.amount.toFixed(2)}`
    ).join('\n');
  
  return Buffer.from(excelContent);
}


