/**
 * Example: Protected API Route with Re-Authentication
 * 
 * This example shows how to implement re-authentication for sensitive operations
 * like voiding checks or processing large payments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireReAuth, requiresReAuthForAmount, requiresReAuthForAction } from '@/lib/reauth';
import { requirePermission, Permission } from '@/lib/rbac';
import { z } from 'zod';

// =============================================================================
// EXAMPLE: DELETE /api/checks/[id] - Void Check with Re-Auth
// =============================================================================

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // First, check basic permissions
    const permissionCheck = requirePermission(Permission.VOID_CHECK);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    // Then, require re-authentication for sensitive operation
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
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

    // Log successful void with re-auth confirmation
    console.log(`Check ${check.checkNumber} voided successfully with re-authentication`);

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
// EXAMPLE: POST /api/checks - Create Check with Amount-Based Re-Auth
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

export async function POST(req: NextRequest) {
  try {
    // Check basic permissions
    const permissionCheck = requirePermission(Permission.CREATE_CHECK);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createCheckSchema.parse(body);

    // Check if amount requires re-authentication
    if (requiresReAuthForAmount(validatedData.amount)) {
      const reAuthCheck = requireReAuth();
      const reAuthResponse = await reAuthCheck(req);
      if (reAuthResponse) {
        return reAuthResponse;
      }
    }

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
    const reAuthNote = requiresReAuthForAmount(validatedData.amount) ? ' (with re-authentication)' : '';
    console.log(`Check ${newCheck.checkNumber} created successfully${reAuthNote}`);

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
// EXAMPLE: PUT /api/banks/[id] - Update Bank with Re-Auth
// =============================================================================

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check basic permissions
    const permissionCheck = requirePermission(Permission.MANAGE_BANKS);
    const permissionResponse = await permissionCheck(req);
    if (permissionResponse) {
      return permissionResponse;
    }

    // Require re-authentication for bank information changes
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
    }

    const bankId = (await params).id;

    // Parse and validate request body
    const body = await req.json();
    const { bankName, accountNumber, routingNumber } = body;

    // Check if bank exists
    const existingBank = await prisma.bank.findUnique({
      where: { id: bankId },
    });

    if (!existingBank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    // Update the bank
    const updatedBank = await prisma.bank.update({
      where: { id: bankId },
      data: {
        bankName,
        accountNumber,
        routingNumber,
      },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log successful bank update with re-auth confirmation
    console.log(`Bank ${updatedBank.bankName} updated successfully with re-authentication`);

    return NextResponse.json(updatedBank);

  } catch (error) {
    console.error('Error updating bank:', error);
    return NextResponse.json(
      { error: 'Failed to update bank' },
      { status: 500 }
    );
  }
}


