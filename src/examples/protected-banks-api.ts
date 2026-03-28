/**
 * Protected API Routes Examples - Banks Management
 * 
 * This file demonstrates how to implement RBAC-protected API routes
 * for bank management operations using the RBAC middleware system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireRole, Permission, Role } from '@/lib/rbac';
import { z } from 'zod';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface CreateBankRequest {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  storeId: string;
  balance: number;
}

interface BankResponse {
  id: string;
  bankName: string;
  accountNumber: string; // This will be encrypted in the database
  routingNumber: string; // This will be encrypted in the database
  storeId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
  store: {
    name: string;
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createBankSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  routingNumber: z.string().min(9, 'Routing number must be at least 9 digits'),
  storeId: z.string().min(1, 'Store ID is required'),
  balance: z.number().min(0, 'Balance cannot be negative'),
});

const updateBankSchema = createBankSchema.partial();

// =============================================================================
// POST /api/banks - Create New Bank (MANAGE_BANKS permission, ADMIN only)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Require ADMIN role for creating banks
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized bank creation attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createBankSchema.parse(body);

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: validatedData.storeId },
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Check if bank account already exists for this store
    const existingBank = await prisma.bank.findFirst({
      where: {
        accountNumber: validatedData.accountNumber,
        storeId: validatedData.storeId,
      },
    });

    if (existingBank) {
      return NextResponse.json(
        { error: 'Bank account already exists for this store' },
        { status: 400 }
      );
    }

    // Create the bank (account numbers will be encrypted by Prisma middleware)
    const newBank = await prisma.bank.create({
      data: {
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        routingNumber: validatedData.routingNumber,
        storeId: validatedData.storeId,
        balance: validatedData.balance,
      },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log successful bank creation
    console.log(`Bank ${newBank.bankName} created successfully`);

    return NextResponse.json(newBank, { status: 201 });

  } catch (error) {
    console.error('Error creating bank:', error);

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
      { error: 'Failed to create bank' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/banks - List Banks (VIEW_BANKS permission, MANAGER+ only)
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Require MANAGER+ role for viewing banks
    const roleCheck = requireRole(Role.MANAGER);
    const response = await roleCheck(req);

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const storeId = searchParams.get('storeId') || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.bankName = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    if (storeId) {
      where.storeId = storeId;
    }

    const banks = await prisma.bank.findMany({
      skip,
      take: limit,
      where,
      include: {
        store: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalBanks = await prisma.bank.count({ where });

    return NextResponse.json({
      data: banks,
      total: totalBanks,
      page,
      limit,
      totalPages: Math.ceil(totalBanks / limit),
    });

  } catch (error) {
    console.error('Error fetching banks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banks' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/banks/[id] - Update Bank (MANAGE_BANKS permission, ADMIN only)
// =============================================================================

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role for updating banks
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized bank update attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const bankId = (await params).id;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateBankSchema.parse(body);

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

    // Check for account number conflicts if account number is being updated
    if (validatedData.accountNumber && validatedData.accountNumber !== existingBank.accountNumber) {
      const accountExists = await prisma.bank.findFirst({
        where: {
          accountNumber: validatedData.accountNumber,
          storeId: validatedData.storeId || existingBank.storeId,
          id: { not: bankId },
        },
      });

      if (accountExists) {
        return NextResponse.json(
          { error: 'Bank account already exists for this store' },
          { status: 400 }
        );
      }
    }

    // Update the bank
    const updatedBank = await prisma.bank.update({
      where: { id: bankId },
      data: validatedData,
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log successful bank update
    console.log(`Bank ${updatedBank.bankName} updated successfully`);

    return NextResponse.json(updatedBank);

  } catch (error) {
    console.error('Error updating bank:', error);

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
      { error: 'Failed to update bank' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/banks/[id] - Delete Bank (MANAGE_BANKS permission, ADMIN only)
// =============================================================================

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role for deleting banks
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized bank deletion attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const bankId = (await params).id;

    // Check if bank exists
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
    });

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    // Check for associated checks
    const associatedChecks = await prisma.check.count({
      where: { bankId },
    });

    if (associatedChecks > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete bank with associated checks',
          details: `This bank has ${associatedChecks} associated check(s)`
        },
        { status: 400 }
      );
    }

    // Check if bank has remaining balance
    if (bank.balance > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete bank with remaining balance',
          details: `This bank has a balance of $${bank.balance.toFixed(2)}`
        },
        { status: 400 }
      );
    }

    // Delete the bank
    await prisma.bank.delete({
      where: { id: bankId },
    });

    // Log successful bank deletion
    console.log(`Bank ${bank.bankName} deleted successfully`);

    return NextResponse.json(
      { message: 'Bank deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting bank:', error);
    return NextResponse.json(
      { error: 'Failed to delete bank' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/banks/[id]/balance - Update Bank Balance (MANAGE_BANKS permission, ADMIN only)
// =============================================================================

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role for updating bank balance
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized bank balance update attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const bankId = (await params).id;

    // Parse and validate request body
    const body = await req.json();
    const { balance, reason } = z.object({
      balance: z.number().min(0, 'Balance cannot be negative'),
      reason: z.string().min(1, 'Reason is required for balance updates'),
    }).parse(body);

    // Check if bank exists
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
    });

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    const oldBalance = bank.balance;

    // Update the bank balance
    const updatedBank = await prisma.bank.update({
      where: { id: bankId },
      data: { balance },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log successful balance update
    console.log(`Bank ${bank.bankName} balance updated from $${oldBalance.toFixed(2)} to $${balance.toFixed(2)}. Reason: ${reason}`);

    return NextResponse.json({
      ...updatedBank,
      oldBalance,
      reason,
    });

  } catch (error) {
    console.error('Error updating bank balance:', error);

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
      { error: 'Failed to update bank balance' },
      { status: 500 }
    );
  }
}





