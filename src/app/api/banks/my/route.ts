import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/guards';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);

    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    const isOfficeAdmin = ctx.role === 'OFFICE_ADMIN' || ctx.role === 'ADMIN';
    const isStoreUser = ctx.role === 'STORE_USER' || ctx.role === 'USER';
    const { searchParams } = new URL(req.url);
    const storeIdParam = searchParams.get('storeId');

    // Build the where clause:
    // SUPER_ADMIN → all banks (optionally filtered by storeId query param)
    // Everyone else → only banks linked via UserBank join table or StoreBank for their assigned store
    let whereClause: any = {};

    if (isSuperAdmin || isOfficeAdmin) {
      // SUPER_ADMIN / OFFICE_ADMIN / ADMIN → all banks, optionally filtered by storeId query param
      if (storeIdParam) {
        const storeIdInt = parseInt(storeIdParam, 10);
        if (!isNaN(storeIdInt)) {
          // Fetch IDs from StoreBank using raw SQL
          const storeBankIds: any[] = await prisma.$queryRaw`
            SELECT "bankId" FROM "StoreBank" WHERE "storeId" = ${storeIdInt}
          `;
          const bankIdsFromStore = storeBankIds.map(a => a.bankId);

          whereClause = {
            OR: [
              { store_id: storeIdInt },
              { id: { in: bankIdsFromStore } }
            ]
          };
        }
      }
    } else if (isStoreUser) {
      // USER / STORE_USER: only banks explicitly assigned to the user.
      // Do not expose all store banks for this role.
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { assigned_bank_id: true },
      });

      const assignedViaJoin = await prisma.userBank.findMany({
        where: { user_id: ctx.userId },
        select: { bank_id: true },
      });

      const allowedBankIds = new Set<number>(assignedViaJoin.map((r) => r.bank_id));
      if (user?.assigned_bank_id) {
        allowedBankIds.add(user.assigned_bank_id);
      }

      if (allowedBankIds.size === 0) {
        return NextResponse.json({ success: true, banks: [] });
      }

      whereClause = {
        id: { in: Array.from(allowedBankIds) },
      };
    } else {
      // For non-super admins:
      const storeIdInt = ctx.storeId ? parseInt(String(ctx.storeId), 10) : NaN;
      
      // Fetch IDs from StoreBank using raw SQL
      let bankIdsFromStore: number[] = [];
      if (!isNaN(storeIdInt)) {
        const storeBankIds: any[] = await prisma.$queryRaw`
          SELECT "bankId" FROM "StoreBank" WHERE "storeId" = ${storeIdInt}
        `;
        bankIdsFromStore = storeBankIds.map(a => a.bankId);
      }

      whereClause = {
        OR: [
          { userBanks: { some: { user_id: ctx.userId } } },
          { id: { in: bankIdsFromStore } }
        ]
      };
    }

    const banks = await prisma.bank.findMany({
      where: whereClause,
      orderBy: { bank_name: 'asc' },
      select: {
        id: true,
        bank_name: true,
        account_name: true,
        account_type: true,
        account_number: true,
        routing_number: true,
        signature_url: true,
        store_id: true,
        dba: true,
        Store: {
          select: { id: true, name: true },
        },
      },
    });

    const payload = banks.map((bank) => ({
      id: bank.id.toString(),
      bank_name: bank.bank_name,
      bankName: bank.bank_name,
      accountName: bank.account_name,
      accountType: bank.account_type,
      signatureUrl: bank.signature_url,
      storeId: bank.store_id ? bank.store_id.toString() : null,
      storeName: bank.Store?.name ?? 'Unassigned Store',
      dba: bank.dba,
      last4: bank.account_number.toString().slice(-4),
      routingMasked: bank.routing_number.toString().length >= 9
        ? `${bank.routing_number.toString().slice(0, 4)}*${bank.routing_number.toString().slice(-4)}`
        : bank.routing_number.toString(),
    }));

    return NextResponse.json({ success: true, banks: payload });
  } catch (error) {
    console.error('[GET /api/banks/my] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load banks', message },
      { status: 500 }
    );
  }
}

