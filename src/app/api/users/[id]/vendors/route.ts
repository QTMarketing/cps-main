import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonGuardError } from "@/lib/guards";
import { z } from "zod";

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

function parseUserId(param: string): number | null {
  const id = parseInt(param, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// =============================================================================
// GET /api/users/[id]/vendors — list assigned + unassigned vendors for a user
// =============================================================================
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);

    // Only admin-like roles can view vendor assignments for arbitrary users
    const canView =
      ctx.role === "SUPER_ADMIN" || ctx.role === "ADMIN" || ctx.role === "OFFICE_ADMIN";

    const { id: idParam } = await context.params;
    const userId = parseUserId(idParam);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (!canView && ctx.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [assigned, unassigned] = await Promise.all([
      prisma.vendor.findMany({
        where: { userVendors: { some: { user_id: userId } } },
        select: VENDOR_SELECT,
        orderBy: { vendor_name: "asc" },
      }),
      prisma.vendor.findMany({
        where: { userVendors: { none: { user_id: userId } } },
        select: VENDOR_SELECT,
        orderBy: { vendor_name: "asc" },
      }),
    ]);

    return NextResponse.json({
      assigned: assigned as VendorSummary[],
      unassigned: unassigned as VendorSummary[],
    });
  } catch (error: any) {
    if (typeof error?.status === "number") return jsonGuardError(error);
    console.error("[GET /api/users/[id]/vendors] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor assignments" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/users/[id]/vendors — batch assign / unassign vendors to a user
// SUPER_ADMIN only (per requirement)
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
    if (ctx.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: SUPER_ADMIN role required" },
        { status: 403 }
      );
    }

    const { id: idParam } = await context.params;
    const userId = parseUserId(idParam);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { assignVendorIds, unassignVendorIds } = parsed.data;
    if (assignVendorIds.length === 0 && unassignVendorIds.length === 0) {
      return NextResponse.json({ ok: true, assigned: 0, unassigned: 0 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate vendors exist
    const allVendorIds = [...new Set([...assignVendorIds, ...unassignVendorIds])];
    if (allVendorIds.length > 0) {
      const found = await prisma.vendor.findMany({
        where: { id: { in: allVendorIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((v) => v.id));
      const missing = allVendorIds.filter((vid) => !foundIds.has(vid));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Vendor IDs not found: ${missing.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const [assignResult, unassignResult] = await prisma.$transaction([
      prisma.userVendor.createMany({
        data: assignVendorIds.map((vendorId) => ({
          user_id: userId,
          vendor_id: vendorId,
        })),
        skipDuplicates: true,
      }),
      prisma.userVendor.deleteMany({
        where:
          unassignVendorIds.length > 0
            ? { user_id: userId, vendor_id: { in: unassignVendorIds } }
            : { id: -1 },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      assigned: assignResult.count,
      unassigned: unassignResult.count,
    });
  } catch (error: any) {
    if (typeof error?.status === "number") return jsonGuardError(error);
    console.error("[PUT /api/users/[id]/vendors] Error:", error);
    return NextResponse.json(
      { error: "Failed to update vendor assignments" },
      { status: 500 }
    );
  }
}
