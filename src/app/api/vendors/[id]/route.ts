import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMinimumRole, Role } from "@/lib/rbac";
import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((val) => (val ? val : null));

const vendorTypeValues = ["MERCHANDISE", "EXPENSE", "EMPLOYEE"] as const;

const updateSchema = z.object({
  vendorName: z.string().trim().min(1).max(150).optional(),
  vendorType: z.enum(vendorTypeValues).optional(),
  description: optionalString(500),
  contactPerson: optionalString(150),
  email: z.string().trim().email().optional().transform((val) => (val ? val : null)),
  phone: optionalString(40),
  address: optionalString(500),
  assignedAccountIds: z.array(z.string().regex(/^\d+$/)).optional(),
});

const vendorInclude = {
  VendorBank: {
    include: {
      bank: {
        select: {
          id: true,
          bank_name: true,
          dba: true,
          account_type: true,
        },
      },
    },
  },
};

const parseVendorId = (idValue: string) => {
  const id = Number(idValue);
  if (Number.isNaN(id)) {
    throw new Error("Invalid vendor id");
  }
  return id;
};

const serializeVendor = (vendor: any) => ({
  id: vendor.id.toString(),
  vendorName: vendor.vendor_name,
  vendorType: vendor.vendor_type,
  description: vendor.description,
  contactPerson: vendor.contact_person,
  email: vendor.email,
  phone: vendor.phone,
  address: vendor.address,
  createdAt: vendor.created_at,
  updatedAt: vendor.updated_at,
  accounts: vendor.VendorBank.map((link: any) => ({
    id: link.bank.id.toString(),
    bankName: link.bank.bank_name,
    dbaName: link.bank.dba,
    accountType: link.bank.account_type,
  })),
});

// GET /api/vendors/[id]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireMinimumRole(Role.ADMIN)(request);
  if (guard) return guard;

  try {
    const { id } = await context.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseVendorId(id) },
      include: vendorInclude,
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, vendor: serializeVendor(vendor) });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json({ error: "Failed to fetch vendor" }, { status: 500 });
  }
}

// PUT /api/vendors/[id]
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireMinimumRole(Role.SUPER_ADMIN)(request);
  if (guard) return guard;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const { id } = await context.params;
    const vendorId = parseVendorId(id);

    const updated = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          vendor_name: data.vendorName ?? undefined,
          vendor_type: data.vendorType ?? undefined,
          description: data.description,
          contact_person: data.contactPerson,
          email: data.email,
          phone: data.phone,
          address: data.address,
        },
      });

      if (data.assignedAccountIds) {
        const bankIds = Array.from(new Set(data.assignedAccountIds)).map((id) => Number(id));
        if (bankIds.some((id) => Number.isNaN(id))) {
          throw new Error("Invalid bank ids provided");
        }

        await tx.vendorBank.deleteMany({ where: { vendor_id: vendorId } });

        if (bankIds.length > 0) {
          const existingBanks = await tx.bank.findMany({
            where: { id: { in: bankIds } },
            select: { id: true },
          });

          if (existingBanks.length !== bankIds.length) {
            throw new Error("One or more bank ids are invalid");
          }

          await tx.vendorBank.createMany({
            data: bankIds.map((id) => ({ vendor_id: vendor.id, bank_id: id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.vendor.findUnique({
        where: { id: vendor.id },
        include: vendorInclude,
      });
    });

    return NextResponse.json({
      success: true,
      vendor: updated ? serializeVendor(updated) : null,
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update vendor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vendors/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireMinimumRole(Role.SUPER_ADMIN)(request);
  if (guard) return guard;

  try {
    const { id } = await context.params;
    await prisma.vendor.delete({
      where: { id: parseVendorId(id) },
    });

    return NextResponse.json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}
