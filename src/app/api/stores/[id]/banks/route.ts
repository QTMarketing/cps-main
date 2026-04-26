import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@/lib/rbac';
import { requireRole } from '@/lib/rbac';

// GET /api/stores/[id]/banks - Get assigned and unassigned banks for a store
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRole(Role.ADMIN);
  const response = await roleCheck(request);
  if (response) return response;

  try {
    const { id } = await context.params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    // Get all banks using regular prisma (these models exist)
    const allBanks = await prisma.bank.findMany({
      orderBy: { bank_name: 'asc' },
    });

    // Assigned banks = StoreBank join rows OR legacy Bank.store_id (Super Admin bank creation
    // sets store_id but does not always insert StoreBank).
    const assignments: any[] = await prisma.$queryRaw`
      SELECT "bankId" FROM "StoreBank" WHERE "storeId" = ${storeId}
    `;

    const assignedBankIds = new Set<number>(
      assignments.map((a: any) => Number(a.bankId)).filter((id: number) => Number.isFinite(id))
    );

    for (const b of allBanks) {
      if (b.store_id === storeId) {
        assignedBankIds.add(b.id);
      }
    }

    const assigned = allBanks
      .filter((b: any) => assignedBankIds.has(b.id))
      .map((b: any) => ({
        id: b.id,
        bank_name: b.bank_name,
        account_type: b.account_type,
      }));

    const unassigned = allBanks
      .filter((b: any) => !assignedBankIds.has(b.id))
      .map((b: any) => ({
        id: b.id,
        bank_name: b.bank_name,
        account_type: b.account_type,
      }));

    return NextResponse.json({ assigned, unassigned });
  } catch (error) {
    console.error('Error fetching store-bank assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

// PUT /api/stores/[id]/banks - Update store-bank assignments
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = requireRole(Role.ADMIN);
  const response = await roleCheck(request);
  if (response) return response;

  try {
    const { id } = await context.params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    const { assignBankIds, unassignBankIds } = await request.json();

    await prisma.$transaction(async (tx: any) => {
      // Unassign: remove StoreBank row and clear legacy Bank.store_id when it points at this store
      if (unassignBankIds && unassignBankIds.length > 0) {
        for (const bankId of unassignBankIds) {
          await tx.$executeRaw`
            DELETE FROM "StoreBank" WHERE "storeId" = ${storeId} AND "bankId" = ${bankId}
          `;
          await tx.bank.updateMany({
            where: { id: bankId, store_id: storeId },
            data: { store_id: null },
          });
        }
      }

      // Assign: StoreBank row + keep Bank.store_id in sync for APIs that still read store_id.
      // A bank has one primary store_id; remove other StoreBank rows for this bank so we do not
      // leave stale links when moving a bank between stores in the UI.
      if (assignBankIds && assignBankIds.length > 0) {
        for (const bankId of assignBankIds) {
          await tx.$executeRaw`
            DELETE FROM "StoreBank" WHERE "bankId" = ${bankId} AND "storeId" <> ${storeId}
          `;
          await tx.$executeRaw`
            INSERT INTO "StoreBank" ("storeId", "bankId", "createdAt")
            VALUES (${storeId}, ${bankId}, NOW())
            ON CONFLICT ("storeId", "bankId") DO NOTHING
          `;
          await tx.bank.update({
            where: { id: bankId },
            data: { store_id: storeId },
          });
        }
      }
    });

    return NextResponse.json({ message: 'Assignments updated successfully' });
  } catch (error) {
    console.error('Error updating store-bank assignments:', error);
    return NextResponse.json({ error: 'Failed to update assignments' }, { status: 500 });
  }
}
