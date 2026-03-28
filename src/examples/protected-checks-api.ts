/**
 * Protected API Routes Examples - Checks Management
 * 
 * This file demonstrates how to implement RBAC-protected API routes
 * for check management operations using the RBAC middleware system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireRole, Permission, Role } from '@/lib/rbac';
import { z } from 'zod';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface CreateCheckRequest {
  checkNumber: string;
  paymentMethod: 'CHECK' | 'EDI' | 'MO' | 'CASH';
  bankId: string;
  vendorId: string;
  amount: number;
  memo?: string;
  issuedBy: string;
}

interface CheckResponse {
  id: string;
  checkNumber: string;
  paymentMethod: string;
  amount: number;
  memo?: string;
  status: string;
  createdAt: string;
  vendor: {
    vendorName: string;
  };
  bank: {
    bankName: string;
  };
  issuedByUser: {
    username: string;
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createCheckSchema = z.object({
  checkNumber: z.string().min(1, 'Check number is required'),
  paymentMethod: z.enum(['CHECK', 'EDI', 'MO', 'CASH'], {
    message: 'Invalid payment method',
  }),
  bankId: z.string().min(1, 'Bank ID is required'),
  vendorId: z.string().min(1, 'Vendor ID is required'),
  amount: z.number().positive('Amount must be positive'),
  memo: z.string().optional(),
  issuedBy: z.string().min(1, 'Issuer ID is required'),
});

// =============================================================================
// POST /api/checks - Create New Check (CREATE_CHECK permission required)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Check CREATE_CHECK permission
    const permissionCheck = requirePermission(Permission.CREATE_CHECK);
    const response = await permissionCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized check creation attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createCheckSchema.parse(body);

    // Verify bank exists and has sufficient balance
    const bank = await prisma.bank.findUnique({
      where: { id: validatedData.bankId },
    });

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    if (bank.balance < validatedData.amount) {
      return NextResponse.json(
        { error: 'Insufficient bank balance' },
        { status: 400 }
      );
    }

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: validatedData.vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Create the check
    const newCheck = await prisma.check.create({
      data: {
        checkNumber: validatedData.checkNumber,
        paymentMethod: validatedData.paymentMethod,
        bankId: validatedData.bankId,
        vendorId: validatedData.vendorId,
        amount: validatedData.amount,
        memo: validatedData.memo,
        status: 'PENDING',
        issuedBy: validatedData.issuedBy,
      },
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
    });

    // Update bank balance
    await prisma.bank.update({
      where: { id: validatedData.bankId },
      data: {
        balance: bank.balance - validatedData.amount,
      },
    });

    // Log successful check creation
    console.log(`Check ${newCheck.checkNumber} created successfully by user ${validatedData.issuedBy}`);

    return NextResponse.json(newCheck, { status: 201 });

  } catch (error) {
    console.error('Error creating check:', error);

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
      { error: 'Failed to create check' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/checks/[id] - Void Check (VOID_CHECK permission, MANAGER+ only)
// =============================================================================

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require MANAGER+ role for voiding checks
    const roleCheck = requireRole(Role.MANAGER);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized void attempt
      console.warn(`Unauthorized check void attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const checkId = (await params).id;

    // Find the check
    const check = await prisma.check.findUnique({
      where: { id: checkId },
      include: {
        bank: true,
        vendor: {
          select: { vendorName: true },
        },
      },
    });

    if (!check) {
      return NextResponse.json(
        { error: 'Check not found' },
        { status: 404 }
      );
    }

    if (check.status === 'VOIDED') {
      return NextResponse.json(
        { error: 'Check is already voided' },
        { status: 400 }
      );
    }

    if (check.status === 'CLEARED') {
      return NextResponse.json(
        { error: 'Cannot void a cleared check' },
        { status: 400 }
      );
    }

    // Void the check
    await prisma.check.update({
      where: { id: checkId },
      data: { status: 'VOIDED' },
    });

    // Restore bank balance if check was pending
    if (check.status === 'PENDING') {
      await prisma.bank.update({
        where: { id: check.bankId },
        data: {
          balance: check.bank.balance + check.amount,
        },
      });
    }

    // Log successful void
    console.log(`Check ${check.checkNumber} voided successfully`);

    return NextResponse.json(
      { message: 'Check voided successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error voiding check:', error);
    return NextResponse.json(
      { error: 'Failed to void check' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/checks - List Checks (VIEW_CHECK permission required)
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Check VIEW_CHECK permission
    const permissionCheck = requirePermission(Permission.VIEW_CHECK);
    const response = await permissionCheck(req);

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || '';
    const vendorId = searchParams.get('vendorId') || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (vendorId) {
      where.vendorId = vendorId;
    }

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

    const totalChecks = await prisma.check.count({ where });

    return NextResponse.json({
      data: checks,
      total: totalChecks,
      page,
      limit,
      totalPages: Math.ceil(totalChecks / limit),
    });

  } catch (error) {
    console.error('Error fetching checks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checks' },
      { status: 500 }
    );
  }
}


