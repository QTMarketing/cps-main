import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";

// GET /api/banks/[id] - Get bank by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request);
    if (ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admin can view banks' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const bankId = Number(id);

    if (isNaN(bankId) || bankId <= 0) {
      return NextResponse.json({ error: 'Invalid bank ID' }, { status: 400 });
    }

    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      include: { Store: true },
    });

    if (!bank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    }

    // Serialize BigInt fields as strings — JSON.stringify cannot handle BigInt natively
    return NextResponse.json({
      id: bank.id,
      bank_name: bank.bank_name,
      account_name: bank.account_name,
      dba: bank.dba,
      account_number: bank.account_number.toString(),
      routing_number: bank.routing_number.toString(),
      return_zip: bank.return_zip != null ? bank.return_zip.toString() : null,
      account_type: bank.account_type,
      signature_name: bank.signature_name,
      signature_url: bank.signature_url,
      return_address: bank.return_address,
      return_city: bank.return_city,
      return_state: bank.return_state,
      store_id: bank.store_id,
      corporation_id: bank.corporation_id,
      created_at: bank.created_at,
      Store: bank.Store
        ? { id: bank.Store.id, code: bank.Store.code, name: bank.Store.name }
        : null,
    });
  } catch (error) {
    console.error('[GET /api/banks/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch bank' }, { status: 500 });
  }
}

// PUT /api/banks/[id] - Update bank
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Add authentication
    const ctx = await requireAuth(request);
    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    
    // Only SUPER_ADMIN can update banks
    if (ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admin can update banks' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    // Parse and validate storeId if provided
    let updateData: any = {};
    
    if (body.storeId !== undefined) {
      // Only SUPER_ADMIN can change store assignment
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admin can change bank store assignment' },
          { status: 403 }
        );
      }
      
      if (body.storeId === null || body.storeId === '') {
        updateData.store_id = null;
      } else {
        const storeIdInt = typeof body.storeId === 'number' 
          ? body.storeId 
          : parseInt(body.storeId, 10);
        
        if (!Number.isFinite(storeIdInt) || storeIdInt <= 0) {
          return NextResponse.json(
            { error: 'Invalid storeId' },
            { status: 400 }
          );
        }
        
        // Validate store exists
        const storeExists = await prisma.store.findUnique({
          where: { id: storeIdInt },
        });
        
        if (!storeExists) {
          return NextResponse.json(
            { error: 'Store not found' },
            { status: 404 }
          );
        }
        
        updateData.store_id = storeIdInt;
      }
      
      console.log('[PUT /api/banks/[id]] SUPER_ADMIN updating bank store_id to:', updateData.store_id);
    }

    // Map other bank fields if provided
    // Note: The body might use camelCase but Prisma expects snake_case
    if (body.bank_name) updateData.bank_name = body.bank_name;
    if (body.account_number) updateData.account_number = BigInt(body.account_number);
    if (body.routing_number) updateData.routing_number = BigInt(body.routing_number);
    if (body.dba !== undefined) updateData.dba = body.dba;
    if (body.account_name !== undefined) updateData.account_name = body.account_name;
    if (body.account_type !== undefined) updateData.account_type = body.account_type;
    if (body.return_address !== undefined) updateData.return_address = body.return_address;
    if (body.return_city !== undefined) updateData.return_city = body.return_city;
    if (body.return_state !== undefined) updateData.return_state = body.return_state;
    if (body.return_zip !== undefined) updateData.return_zip = body.return_zip ? BigInt(body.return_zip) : null;
    if (body.signature_name !== undefined) updateData.signature_name = body.signature_name;

    const bank = await prisma.bank.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        Store: true,
      },
    });

    console.log('[PUT /api/banks/[id]] Bank updated:', bank.id, 'store_id:', bank.store_id);

    return NextResponse.json({
      id: bank.id,
      bank_name: bank.bank_name,
      account_name: bank.account_name,
      dba: bank.dba,
      account_number: bank.account_number.toString(),
      routing_number: bank.routing_number.toString(),
      return_zip: bank.return_zip != null ? bank.return_zip.toString() : null,
      account_type: bank.account_type,
      signature_name: bank.signature_name,
      signature_url: bank.signature_url,
      return_address: bank.return_address,
      return_city: bank.return_city,
      return_state: bank.return_state,
      store_id: bank.store_id,
      corporation_id: bank.corporation_id,
      created_at: bank.created_at,
      Store: bank.Store
        ? { id: bank.Store.id, code: bank.Store.code, name: bank.Store.name }
        : null,
    });
  } catch (error) {
    console.error('Error updating bank:', error);
    return NextResponse.json(
      { error: 'Failed to update bank', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/banks/[id] - Delete bank
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Add authentication
    const ctx = await requireAuth(request);
    
    // Only SUPER_ADMIN can delete banks
    if (ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admin can delete banks' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const bankId = Number(id);

    if (isNaN(bankId) || bankId <= 0) {
      return NextResponse.json(
        { error: 'Invalid bank ID' },
        { status: 400 }
      );
    }

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

    console.log(`[DELETE /api/banks/${bankId}] Checking dependencies before deletion`);

    // PHASE 2: Check dependencies before deletion
    const [checkCount, vendorBankCount, bankSignerCount] = await Promise.all([
      prisma.check.count({ where: { bank_id: bankId } }),
      prisma.vendorBank.count({ where: { bank_id: bankId } }),
      prisma.bankSigner.count({ where: { bank_id: bankId } }),
    ]);

    console.log(`[DELETE /api/banks/${bankId}] Dependencies:`, {
      checks: checkCount,
      vendorBanks: vendorBankCount,
      bankSigners: bankSignerCount,
    });

    // If checks or vendorBanks exist, block deletion (hard dependencies)
    if (checkCount > 0 || vendorBankCount > 0) {
      const dependencies: string[] = [];
      if (checkCount > 0) dependencies.push(`${checkCount} check${checkCount > 1 ? 's' : ''}`);
      if (vendorBankCount > 0) dependencies.push(`${vendorBankCount} vendor link${vendorBankCount > 1 ? 's' : ''}`);

      return NextResponse.json(
        {
          error: 'Cannot delete bank',
          message: `This bank cannot be deleted because it is referenced by ${dependencies.join(', ')}`,
          dependencies: {
            checks: checkCount,
            vendorBanks: vendorBankCount,
            bankSigners: bankSignerCount,
          },
        },
        { status: 409 } // Conflict
      );
    }

    // If only BankSigner dependencies exist, automatically clean them up
    if (bankSignerCount > 0) {
      console.log(`[DELETE /api/banks/${bankId}] Automatically deleting ${bankSignerCount} BankSigner record(s)`);
      await prisma.bankSigner.deleteMany({
        where: { bank_id: bankId },
      });
      console.log(`[DELETE /api/banks/${bankId}] BankSigner records deleted`);
    }

    // No blocking dependencies, safe to delete bank
    await prisma.bank.delete({
      where: { id: bankId },
    });

    console.log(`[DELETE /api/banks/${bankId}] Bank deleted successfully`);

    return NextResponse.json({ 
      message: 'Bank deleted successfully',
      id: bankId,
      cleanedUp: bankSignerCount > 0 ? { bankSigners: bankSignerCount } : undefined,
    });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[DELETE /api/banks/${id}] Error:`, error);

    // Check if it's a Prisma foreign key error
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: any };
      
      if (prismaError.code === 'P2003') {
        // Foreign key constraint violation
        return NextResponse.json(
          {
            error: 'Cannot delete bank',
            message: 'This bank cannot be deleted because it is referenced by other records (checks, vendors, or signers)',
            details: 'Foreign key constraint violation',
          },
          { status: 409 }
        );
      }

      if (prismaError.code === 'P2025') {
        // Record not found
        return NextResponse.json(
          { error: 'Bank not found' },
          { status: 404 }
        );
      }
    }

    // Generic error response with details
    return NextResponse.json(
      { 
        error: 'Failed to delete bank',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
