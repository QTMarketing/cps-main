/**
 * Example: Check Operations with Comprehensive Audit Logging
 * 
 * This example shows how to integrate audit logging into check operations
 * with complete before/after state tracking and financial impact logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, Permission } from '@/lib/rbac';
import { requireReAuth } from '@/lib/reauth';
import { 
  logCheckOperation, 
  AuditAction, 
  EntityType 
} from '@/lib/audit-log';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createCheckSchema = z.object({
  checkNumber: z.string().min(1, 'Check number is required'),
  paymentMethod: z.enum(['CHECK', 'EDI', 'MO', 'CASH']),
  bankId: z.string().min(1, 'Bank ID is required'),
  vendorId: z.string().min(1, 'Vendor ID is required'),
  amount: z.number().positive('Amount must be positive'),
  memo: z.string().optional(),
  issuedBy: z.string().min(1, 'Issuer ID is required'),
});

const updateCheckSchema = createCheckSchema.partial();

// =============================================================================
// POST /api/checks - Create Check with Audit Logging
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Check permissions
    const permissionCheck = requirePermission(Permission.CREATE_CHECK);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    // Check for re-auth if amount is large
    const body = await req.json();
    const validatedData = createCheckSchema.parse(body);
    
    if (validatedData.amount >= 10000) {
      const reAuthCheck = requireReAuth();
      const reAuthResponse = await reAuthCheck(req);
      if (reAuthResponse) {
        return reAuthResponse;
      }
    }

    // Get current bank balance for audit
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
    const updatedBank = await prisma.bank.update({
      where: { id: validatedData.bankId },
      data: {
        balance: bank.balance - validatedData.amount,
      },
    });

    // Log audit event with complete financial state
    await logCheckOperation(
      req,
      validatedData.issuedBy,
      AuditAction.CREATE_CHECK,
      newCheck.id,
      undefined, // No old values for creation
      {
        checkNumber: newCheck.checkNumber,
        paymentMethod: newCheck.paymentMethod,
        amount: newCheck.amount,
        memo: newCheck.memo,
        status: newCheck.status,
        vendor: newCheck.vendor.vendorName,
        bank: newCheck.bank.bankName,
      },
      {
        oldBalance: bank.balance,
        newBalance: updatedBank.balance,
      }
    );

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
// PUT /api/checks/[id] - Update Check with Audit Logging
// =============================================================================

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permissions
    const permissionCheck = requirePermission(Permission.EDIT_CHECK);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    const checkId = (await params).id;

    // Get current check state for audit
    const currentCheck = await prisma.check.findUnique({
      where: { id: checkId },
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

    if (!currentCheck) {
      return NextResponse.json(
        { error: 'Check not found' },
        { status: 404 }
      );
    }

    // Parse and validate update data
    const body = await req.json();
    const validatedData = updateCheckSchema.parse(body);

    // Update the check
    const updatedCheck = await prisma.check.update({
      where: { id: checkId },
      data: validatedData,
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

    // Log audit event with before/after state
    await logCheckOperation(
      req,
      currentCheck.issuedBy,
      AuditAction.UPDATE_CHECK,
      checkId,
      {
        checkNumber: currentCheck.checkNumber,
        paymentMethod: currentCheck.paymentMethod,
        amount: currentCheck.amount,
        memo: currentCheck.memo,
        status: currentCheck.status,
        vendor: currentCheck.vendor.vendorName,
        bank: currentCheck.bank.bankName,
      },
      {
        checkNumber: updatedCheck.checkNumber,
        paymentMethod: updatedCheck.paymentMethod,
        amount: updatedCheck.amount,
        memo: updatedCheck.memo,
        status: updatedCheck.status,
        vendor: updatedCheck.vendor.vendorName,
        bank: updatedCheck.bank.bankName,
      }
    );

    return NextResponse.json(updatedCheck);

  } catch (error) {
    console.error('Error updating check:', error);

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
      { error: 'Failed to update check' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/checks/[id] - Void Check with Audit Logging
// =============================================================================

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permissions
    const permissionCheck = requirePermission(Permission.VOID_CHECK);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    // Require re-authentication for voiding checks
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
    }

    const checkId = (await params).id;

    // Get current check state for audit
    const currentCheck = await prisma.check.findUnique({
      where: { id: checkId },
      include: {
        bank: true,
        vendor: {
          select: { vendorName: true },
        },
      },
    });

    if (!currentCheck) {
      return NextResponse.json(
        { error: 'Check not found' },
        { status: 404 }
      );
    }

    if (currentCheck.status === 'VOIDED') {
      return NextResponse.json(
        { error: 'Check is already voided' },
        { status: 400 }
      );
    }

    if (currentCheck.status === 'CLEARED') {
      return NextResponse.json(
        { error: 'Cannot void a cleared check' },
        { status: 400 }
      );
    }

    // Void the check
    const voidedCheck = await prisma.check.update({
      where: { id: checkId },
      data: { status: 'VOIDED' },
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

    // Restore bank balance if check was pending
    let bankBalanceChange;
    if (currentCheck.status === 'PENDING') {
      const updatedBank = await prisma.bank.update({
        where: { id: currentCheck.bankId },
        data: {
          balance: currentCheck.bank.balance + currentCheck.amount,
        },
      });

      bankBalanceChange = {
        oldBalance: currentCheck.bank.balance,
        newBalance: updatedBank.balance,
      };
    }

    // Log audit event with complete state change
    await logCheckOperation(
      req,
      currentCheck.issuedBy,
      AuditAction.VOID_CHECK,
      checkId,
      {
        checkNumber: currentCheck.checkNumber,
        paymentMethod: currentCheck.paymentMethod,
        amount: currentCheck.amount,
        memo: currentCheck.memo,
        status: currentCheck.status,
        vendor: currentCheck.vendor.vendorName,
        bank: currentCheck.bank.bankName,
      },
      {
        checkNumber: voidedCheck.checkNumber,
        paymentMethod: voidedCheck.paymentMethod,
        amount: voidedCheck.amount,
        memo: voidedCheck.memo,
        status: voidedCheck.status,
        vendor: voidedCheck.vendor.vendorName,
        bank: voidedCheck.bank.bankName,
      },
      bankBalanceChange
    );

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
// PATCH /api/checks/[id]/print - Print Check with Audit Logging
// =============================================================================

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permissions
    const permissionCheck = requirePermission(Permission.PRINT_CHECK);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    const checkId = (await params).id;

    // Get current check state for audit
    const currentCheck = await prisma.check.findUnique({
      where: { id: checkId },
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

    if (!currentCheck) {
      return NextResponse.json(
        { error: 'Check not found' },
        { status: 404 }
      );
    }

    if (currentCheck.status === 'VOIDED') {
      return NextResponse.json(
        { error: 'Cannot print a voided check' },
        { status: 400 }
      );
    }

    // Update check status to printed
    const printedCheck = await prisma.check.update({
      where: { id: checkId },
      data: { status: 'PRINTED' },
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

    // Log audit event
    await logCheckOperation(
      req,
      currentCheck.issuedBy,
      AuditAction.PRINT_CHECK,
      checkId,
      {
        checkNumber: currentCheck.checkNumber,
        paymentMethod: currentCheck.paymentMethod,
        amount: currentCheck.amount,
        memo: currentCheck.memo,
        status: currentCheck.status,
        vendor: currentCheck.vendor.vendorName,
        bank: currentCheck.bank.bankName,
      },
      {
        checkNumber: printedCheck.checkNumber,
        paymentMethod: printedCheck.paymentMethod,
        amount: printedCheck.amount,
        memo: printedCheck.memo,
        status: printedCheck.status,
        vendor: printedCheck.vendor.vendorName,
        bank: printedCheck.bank.bankName,
      }
    );

    return NextResponse.json(
      { message: 'Check printed successfully', check: printedCheck },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error printing check:', error);
    return NextResponse.json(
      { error: 'Failed to print check' },
      { status: 500 }
    );
  }
}


