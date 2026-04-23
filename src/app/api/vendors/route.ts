import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/roles";
import { requireAuth, requireRole, jsonGuardError } from "@/lib/guards";
import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((val) => (val ? val || null : null));

const vendorTypeValues = ["MERCHANDISE", "EXPENSE", "EMPLOYEE"] as const;

const createVendorSchema = z.object({
  vendorName: z.string().trim().min(1, "Vendor name is required").max(150),
  vendorType: z.enum(vendorTypeValues),
  description: optionalString(500),
  contactPerson: optionalString(150),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .transform((val) => (val ? val : null)),
  phone: optionalString(40),
  address: optionalString(500),
  assignedAccountIds: z.array(z.string().regex(/^\d+$/, "Bank id must be numeric")).default([]),
});

const updateVendorSchema = createVendorSchema.partial().extend({
  assignedAccountIds: z.array(z.string().regex(/^\d+$/)).optional(),
});

const vendorInclude = {
  VendorBank: {
    include: {
      Bank: {
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

function serializeVendor(vendor: any) {
  return {
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
      id: link.Bank?.id?.toString() ?? "",
      bankName: link.Bank?.bank_name ?? "",
      dbaName: link.Bank?.dba ?? "",
      accountType: link.Bank?.account_type ?? "",
    })),
  };
}

// GET /api/vendors - Get all vendors
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    const isStoreUser = ctx.role === 'STORE_USER';
    const isPlainUser = ctx.role === 'USER';
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    // Build search filter
    const searchWhere = q
      ? {
          OR: [
            { vendor_name: { contains: q, mode: "insensitive" } },
            { contact_person: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined;

    // Bank-scoped access: if bankId provided, filter by VendorBank join
    // If no bankId, only SUPER_ADMIN may list all vendors
    const bankId = searchParams.get("bankId");
    let assignmentWhere: any;
    if (bankId) {
      const bankIdInt = parseInt(bankId, 10);
      if (isNaN(bankIdInt) || bankIdInt <= 0) {
        return NextResponse.json({ error: "Invalid bankId" }, { status: 400 });
      }

      // STORE_USER can only query vendors for explicitly assigned banks
      if (isStoreUser) {
        const [assignedViaJoin, userRow] = await Promise.all([
          prisma.userBank.findFirst({
            where: { user_id: ctx.userId, bank_id: bankIdInt },
            select: { id: true },
          }),
          prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { assigned_bank_id: true },
          }),
        ]);

        const hasDirectAssignedBank = userRow?.assigned_bank_id === bankIdInt;
        if (!assignedViaJoin && !hasDirectAssignedBank) {
          return NextResponse.json(
            { error: "Forbidden: bankId is not assigned to this user" },
            { status: 403 }
          );
        }
      }

      assignmentWhere = { VendorBank: { some: { bank_id: bankIdInt } } };
    } else if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: bankId required" }, { status: 403 });
    }

    // User/vendor assignments: store users (and USER) can only see vendors assigned to them
    // when listing vendors for Write Checks.
    const userVendorWhere =
      (isStoreUser || isPlainUser) ? { userVendors: { some: { user_id: ctx.userId } } } : undefined;

    const where: any =
      searchWhere && assignmentWhere && userVendorWhere
        ? { AND: [searchWhere, assignmentWhere, userVendorWhere] }
        : searchWhere && assignmentWhere
        ? { AND: [searchWhere, assignmentWhere] }
        : assignmentWhere && userVendorWhere
        ? { AND: [assignmentWhere, userVendorWhere] }
        : searchWhere && userVendorWhere
        ? { AND: [searchWhere, userVendorWhere] }
        : searchWhere ?? assignmentWhere ?? userVendorWhere;

    const vendorDelegate = prisma.vendor as typeof prisma.vendor | undefined;
    if (!vendorDelegate) {
      console.error("Prisma client is missing 'vendor' delegate", {
        availableKeys: Object.keys(prisma as any),
      });
      throw new Error("Prisma client is missing 'vendor' delegate");
    }

    const vendors = await vendorDelegate.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: vendorInclude,
    });

    return NextResponse.json({
      success: true,
      vendors: vendors.map(serializeVendor),
    });
  } catch (error: any) {
    if (typeof error?.status === "number") {
      return jsonGuardError(error);
    }
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load vendors",
        details:
          error instanceof Error ? error.message : JSON.stringify(error),
      },
      { status: 500 }
    );
  }
}

// POST /api/vendors - Create a new vendor
export async function POST(request: NextRequest) {
  try {
    await requireRole(request, [Role.SUPER_ADMIN, Role.OFFICE_ADMIN, Role.ADMIN]);
    const body = await request.json();
    const data = createVendorSchema.parse(body);

    const bankIds = Array.from(new Set(data.assignedAccountIds || [])).map((id) => Number(id));
    if (bankIds.some((id) => Number.isNaN(id))) {
      return NextResponse.json({ error: "Invalid bank ids provided" }, { status: 400 });
    }

    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          vendor_name: data.vendorName.trim(),
          vendor_type: data.vendorType,
          description: data.description,
          contact_person: data.contactPerson,
          email: data.email,
          phone: data.phone,
          address: data.address,
          updated_at: new Date(), // Required field in schema
        },
      });

      if (bankIds.length > 0) {
        const existingBanks = await tx.bank.findMany({
          where: { id: { in: bankIds } },
          select: { id: true },
        });

        if (existingBanks.length !== bankIds.length) {
          throw new Error("One or more bank ids are invalid");
        }

        await tx.vendorBank.createMany({
          data: bankIds.map((id) => ({ vendor_id: created.id, bank_id: id })),
          skipDuplicates: true,
        });
      }

      return tx.vendor.findUnique({
        where: { id: created.id },
        include: vendorInclude,
      });
    });

    return NextResponse.json(
      { success: true, vendor: vendor ? serializeVendor(vendor) : null },
      { status: 201 }
    );
  } catch (error) {
    if (typeof (error as any)?.status === "number") {
      return jsonGuardError(error);
    }
    console.error("Error creating vendor:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to create vendor";
    return NextResponse.json(
      { error: "Failed to create vendor", message },
      { status: 500 }
    );
  }
}
