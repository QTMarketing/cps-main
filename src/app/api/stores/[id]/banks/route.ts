import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@/lib/rbac';
import { requireRole } from '@/lib/rbac';

const prismaUnsafe = prisma as any;

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

    // Get assigned bank IDs using raw SQL since StoreBank might not be in the client yet
    const assignments: any[] = await prisma.$queryRaw`
      SELECT "bankId" FROM "StoreBank" WHERE "storeId" = ${storeId}
    `;

    const assignedBankIds = new Set(assignments.map((a: any) => a.bankId));

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
      // Unassign using raw SQL
      if (unassignBankIds && unassignBankIds.length > 0) {
        for (const bankId of unassignBankIds) {
          await tx.$executeRaw`
            DELETE FROM "StoreBank" WHERE "storeId" = ${storeId} AND "bankId" = ${bankId}
          `;
        }
      }

      // Assign using raw SQL
      if (assignBankIds && assignBankIds.length > 0) {
        for (const bankId of assignBankIds) {
          await tx.$executeRaw`
            INSERT INTO "StoreBank" ("storeId", "bankId", "createdAt")
            VALUES (${storeId}, ${bankId}, NOW())
            ON CONFLICT ("storeId", "bankId") DO NOTHING
          `;
        }
      }
    });

    return NextResponse.json({ message: 'Assignments updated successfully' });
  } catch (error) {
    console.error('Error updating store-bank assignments:', error);
    return NextResponse.json({ error: 'Failed to update assignments' }, { status: 500 });
  }
}
