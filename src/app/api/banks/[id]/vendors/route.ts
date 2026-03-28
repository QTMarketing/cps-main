import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonGuardError } from '@/lib/guards';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

type VendorSummary = {
  id: number;
  vendor_name: string;
  vendor_type: string;
};

const VENDOR_SELECT = {
  id: true,
  vendor_name: true,
  vendor_type: true,
} as const;

// =============================================================================
// GET /api/banks/[id]/vendors — list assigned + unassigned vendors for a bank
// =============================================================================

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);

    if (ctx.role === 'USER') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const bankId = parseInt(id, 10);
    if (isNaN(bankId) || bankId <= 0) {
      return NextResponse.json({ error: 'Invalid bank ID' }, { status: 400 });
    }

    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true },
    });

    if (!bank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    }

    const [assignedVendors, unassignedVendors] = await Promise.all([
      prisma.vendor.findMany({
        where: { VendorBank: { some: { bank_id: bankId } } },
        select: VENDOR_SELECT,
        orderBy: { vendor_name: 'asc' },
      }),
      prisma.vendor.findMany({
        where: { VendorBank: { none: { bank_id: bankId } } },
        select: VENDOR_SELECT,
        orderBy: { vendor_name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      assigned: assignedVendors as VendorSummary[],
      unassigned: unassignedVendors as VendorSummary[],
    });
  } catch (error: any) {
    if (error?.status) return jsonGuardError(error);
    console.error('[GET /api/banks/[id]/vendors] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor assignments' }, { status: 500 });
  }
}

// =============================================================================
// PUT /api/banks/[id]/vendors — batch assign / unassign vendors to a bank
// =============================================================================

const putSchema = z.object({
  assignVendorIds: z.array(z.number().int().positive()).default([]),
  unassignVendorIds: z.array(z.number().int().positive()).default([]),
});

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);

    if (ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: SUPER_ADMIN role required' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const bankId = parseInt(id, 10);
    if (isNaN(bankId) || bankId <= 0) {
      return NextResponse.json({ error: 'Invalid bank ID' }, { status: 400 });
    }

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

    const { assignVendorIds, unassignVendorIds } = parsed.data;

    if (assignVendorIds.length === 0 && unassignVendorIds.length === 0) {
      return NextResponse.json({ ok: true, assigned: 0, unassigned: 0 });
    }

    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true },
    });

    if (!bank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    }

    // Validate all referenced vendor IDs exist
    const allVendorIds = [...new Set([...assignVendorIds, ...unassignVendorIds])];
    if (allVendorIds.length > 0) {
      const found = await prisma.vendor.findMany({
        where: { id: { in: allVendorIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map(v => v.id));
      const missing = allVendorIds.filter(vid => !foundIds.has(vid));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Vendor IDs not found: ${missing.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const [assignResult, unassignResult] = await prisma.$transaction([
      prisma.vendorBank.createMany({
        data: assignVendorIds.map(vendorId => ({
          bank_id: bankId,
          vendor_id: vendorId,
        })),
        skipDuplicates: true,
      }),
      prisma.vendorBank.deleteMany({
        where:
          unassignVendorIds.length > 0
            ? { bank_id: bankId, vendor_id: { in: unassignVendorIds } }
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
    console.error('[PUT /api/banks/[id]/vendors] Error:', error);
    return NextResponse.json({ error: 'Failed to update vendor assignments' }, { status: 500 });
  }
}
