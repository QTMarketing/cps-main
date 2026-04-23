import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonGuardError } from "@/lib/guards";
import { z } from "zod";

const putSchema = z.object({
  /** Vendor IDs to assign to all users (create missing links). */
  assignVendorIds: z.array(z.number().int().positive()).default([]),
});

// =============================================================================
// PUT /api/users/vendors/bulk — assign selected vendors to all users (SUPER_ADMIN only)
// =============================================================================
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: SUPER_ADMIN role required" },
        { status: 403 }
      );
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

    const assignVendorIds = Array.from(new Set(parsed.data.assignVendorIds));
    if (assignVendorIds.length === 0) {
      return NextResponse.json({ ok: true, assignedLinks: 0 });
    }

    // Validate vendors exist
    const found = await prisma.vendor.findMany({
      where: { id: { in: assignVendorIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((v) => v.id));
    const missing = assignVendorIds.filter((vid) => !foundIds.has(vid));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Vendor IDs not found: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      select: { id: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ ok: true, assignedLinks: 0 });
    }

    // Create all links, skip duplicates.
    const data = users.flatMap((u) =>
      assignVendorIds.map((vendorId) => ({
        user_id: u.id,
        vendor_id: vendorId,
      }))
    );

    const result = await prisma.userVendor.createMany({
      data,
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true, assignedLinks: result.count });
  } catch (error: any) {
    if (typeof error?.status === "number") return jsonGuardError(error);
    console.error("[PUT /api/users/vendors/bulk] Error:", error);
    return NextResponse.json(
      { error: "Failed to bulk-assign vendors" },
      { status: 500 }
    );
  }
}

