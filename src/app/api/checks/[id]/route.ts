import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { chequeSelect, mapChequeRecord } from '@/lib/cheques/transformers';
import { jsonGuardError, requireAuth } from '@/lib/guards';

// GET /api/checks/[id] - Get check by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request);
    const { id } = await context.params;
    const checkId = parseInt(id, 10);
    if (Number.isNaN(checkId)) {
      return NextResponse.json({ error: 'Invalid check id' }, { status: 400 });
    }

    // Fetch store_id for scoping + cheque payload
    const check = await prisma.check.findUnique({
      where: { id: checkId },
      select: { ...chequeSelect, store_id: true },
    });

    if (!check) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 });
    }

    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    const isOfficeAdmin = ctx.role === 'OFFICE_ADMIN' || ctx.role === 'ADMIN';
    const isBackOffice = ctx.role === 'BACK_OFFICE';
    const isStoreRestrictedUser = ctx.role === 'USER' || ctx.role === 'STORE_USER';

    if (isStoreRestrictedUser) {
      if (ctx.storeId == null) {
        return NextResponse.json({ error: 'Forbidden', message: 'No store assigned to user' }, { status: 403 });
      }
      if (check.store_id !== ctx.storeId) {
        return NextResponse.json({ error: 'Forbidden', message: 'You do not have access to this check' }, { status: 403 });
      }
    } else if (!isSuperAdmin && !isOfficeAdmin && !isBackOffice) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = mapChequeRecord(check as any);

    return NextResponse.json(payload);
  } catch (error) {
    if (typeof (error as any)?.status === 'number') {
      return jsonGuardError(error);
    }
    console.error('Error fetching check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined;
    
    return NextResponse.json({ 
      error: 'Failed to fetch check',
      message: errorMessage,
      ...(errorStack && { stack: errorStack })
    }, { status: 500 });
  }
}

// PUT /api/checks/[id] - Update check
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request);
    if (ctx.role === 'BACK_OFFICE') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Back Office role cannot update checks' },
        { status: 403 }
      );
    }

    const isStoreRestrictedUser = ctx.role === 'USER' || ctx.role === 'STORE_USER';
    if (isStoreRestrictedUser) {
      const { id } = await context.params;
      const checkId = parseInt(id, 10);
      if (Number.isNaN(checkId)) {
        return NextResponse.json({ error: 'Invalid check id' }, { status: 400 });
      }
      const found = await prisma.check.findUnique({ where: { id: checkId }, select: { store_id: true } });
      if (!found) return NextResponse.json({ error: 'Check not found' }, { status: 404 });
      if (ctx.storeId == null) {
        return NextResponse.json({ error: 'Forbidden', message: 'No store assigned to user' }, { status: 403 });
      }
      if (found.store_id !== ctx.storeId) {
        return NextResponse.json({ error: 'Forbidden', message: 'You do not have access to this check' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { amount, memo, payeeName, bankId, invoiceUrl } = body;

    // Build update data with only fields that exist in the schema
    const updateData: any = {};
    
    if (amount !== undefined) {
      updateData.amount = new Prisma.Decimal(amount);
    }
    if (memo !== undefined) {
      updateData.memo = memo;
    }
    if (payeeName !== undefined) {
      updateData.payee_name = payeeName;
    }
    if (bankId !== undefined) {
      updateData.bank_id = parseInt(bankId, 10);
    }
    if (invoiceUrl !== undefined) {
      updateData.invoice_url = invoiceUrl;
    }

    const { id } = await context.params;
    const check = await prisma.check.update({
      where: { id: parseInt(id, 10) },
      data: updateData,
      select: {
        id: true,
        check_number: true,
        bank_id: true,
        amount: true,
        payee_name: true,
        memo: true,
        invoice_url: true,
        created_at: true,
        Bank: {
          select: {
            id: true,
            bank_name: true,
            dba: true,
            account_type: true,
            account_number: true,
            routing_number: true,
          },
        },
      },
    });

    // Format response
    const payload = {
      id: check.id.toString(),
      createdAt: check.created_at,
      checkNumber: Number(check.check_number),
      bank: {
        id: check.Bank.id.toString(),
        bankName: check.Bank.bank_name,
        dba: check.Bank.dba,
        accountType: check.Bank.account_type,
      },
      amount: check.amount ? Number(check.amount) : 0,
      memo: check.memo ?? null,
      payeeName: check.payee_name ?? null,
      invoiceUrl: check.invoice_url ?? null,
      status: 'ISSUED',
      paymentMethod: 'CHECK',
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error updating check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Failed to update check',
      message: errorMessage
    }, { status: 500 });
  }
}

// DELETE /api/checks/[id] - Delete check
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request);
    if (ctx.role === 'BACK_OFFICE') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Back Office role cannot delete checks' },
        { status: 403 }
      );
    }

    const isStoreRestrictedUser = ctx.role === 'USER' || ctx.role === 'STORE_USER';
    if (isStoreRestrictedUser) {
      const { id } = await context.params;
      const checkId = parseInt(id, 10);
      if (Number.isNaN(checkId)) {
        return NextResponse.json({ error: 'Invalid check id' }, { status: 400 });
      }
      const found = await prisma.check.findUnique({ where: { id: checkId }, select: { store_id: true } });
      if (!found) return NextResponse.json({ error: 'Check not found' }, { status: 404 });
      if (ctx.storeId == null) {
        return NextResponse.json({ error: 'Forbidden', message: 'No store assigned to user' }, { status: 403 });
      }
      if (found.store_id !== ctx.storeId) {
        return NextResponse.json({ error: 'Forbidden', message: 'You do not have access to this check' }, { status: 403 });
      }
    }

    const { id } = await context.params;
    await prisma.check.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json({ message: 'Check deleted successfully' });
  } catch (error) {
    console.error('Error deleting check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Failed to delete check',
      message: errorMessage
    }, { status: 500 });
  }
}
