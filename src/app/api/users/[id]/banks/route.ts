import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonGuardError } from '@/lib/guards';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

type BankSummary = {
  id: number;
  bank_name: string;
  account_type: string;
  last4: string;
  store_id: number | null;
  storeName: string;
};

function toBankSummary(bank: {
  id: number;
  bank_name: string;
  account_type: string;
  account_number: bigint;
  store_id: number | null;
  Store: { name: string } | null;
}): BankSummary {
  return {
    id: bank.id,
    bank_name: bank.bank_name,
    account_type: bank.account_type,
    last4: bank.account_number.toString().slice(-4),
    store_id: bank.store_id,
    storeName: bank.Store?.name ?? 'Unassigned Store',
  };
}

const BANK_SELECT = {
  id: true,
  bank_name: true,
  account_type: true,
  account_number: true,
  store_id: true,
  Store: { select: { name: true } },
} as const;

// =============================================================================
// GET /api/users/[id]/banks — list assigned + unassigned banks via UserBank
// =============================================================================

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);

    // USER role is forbidden
    if (ctx.role === 'USER') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const targetUserId = parseInt(id, 10);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Assigned: banks linked via UserBank join table
    const assignedBanks = await prisma.bank.findMany({
      where: { userBanks: { some: { user_id: targetUserId } } },
      select: BANK_SELECT,
      orderBy: { bank_name: 'asc' },
    });

    // Unassigned: all banks NOT yet linked to this user (cross-store allowed)
    const unassignedBanks = await prisma.bank.findMany({
      where: { userBanks: { none: { user_id: targetUserId } } },
      select: BANK_SELECT,
      orderBy: { bank_name: 'asc' },
    });

    return NextResponse.json({
      assigned: assignedBanks.map(toBankSummary),
      unassigned: unassignedBanks.map(toBankSummary),
    });
  } catch (error: any) {
    if (error?.status) return jsonGuardError(error);
    console.error('[GET /api/users/[id]/banks] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch bank assignments' }, { status: 500 });
  }
}

// =============================================================================
// PUT /api/users/[id]/banks — batch assign / unassign via UserBank
// =============================================================================

const putSchema = z.object({
  assignBankIds: z.array(z.number().int().positive()).default([]),
  unassignBankIds: z.array(z.number().int().positive()).default([]),
});

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);

    // USER role is forbidden
    if (ctx.role === 'USER') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const targetUserId = parseInt(id, 10);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Parse and validate body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { assignBankIds, unassignBankIds } = parsed.data;

    if (assignBankIds.length === 0 && unassignBankIds.length === 0) {
      return NextResponse.json({ ok: true, assigned: 0, unassigned: 0 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate all referenced bank IDs exist
    const allBankIds = [...new Set([...assignBankIds, ...unassignBankIds])];
    if (allBankIds.length > 0) {
      const foundBanks = await prisma.bank.findMany({
        where: { id: { in: allBankIds } },
        select: { id: true, bank_name: true },
      });

      const foundIds = new Set(foundBanks.map(b => b.id));
      const missingIds = allBankIds.filter(id => !foundIds.has(id));
      if (missingIds.length > 0) {
        return NextResponse.json(
          { error: `Bank IDs not found: ${missingIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Execute assign + unassign in a single transaction
    const [assignResult, unassignResult] = await prisma.$transaction([
      // Assign: insert UserBank rows, skip if already assigned (many-to-many allows sharing)
      prisma.userBank.createMany({
        data: assignBankIds.map(bankId => ({
          user_id: targetUserId,
          bank_id: bankId,
        })),
        skipDuplicates: true,
      }),
      // Unassign: remove UserBank rows for this user
      prisma.userBank.deleteMany({
        where:
          unassignBankIds.length > 0
            ? { user_id: targetUserId, bank_id: { in: unassignBankIds } }
            : { id: -1 },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      assigned: assignResult.count,
      unassigned: unassignResult.count,
    });
  } catch (error: any) {
    if (error?.status) return jsonGuardError(error);
    console.error('[PUT /api/users/[id]/banks] Error:', error);
    return NextResponse.json({ error: 'Failed to update bank assignments' }, { status: 500 });
  }
}
