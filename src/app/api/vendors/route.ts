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
          store_id: true,
          Store: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
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
      storeId: link.Bank?.store_id != null ? String(link.Bank.store_id) : null,
      storeName: link.Bank?.Store?.name ?? null,
      storeCode: link.Bank?.Store?.code ?? null,
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

    // Bank-scoped access: if bankId provided, we can filter vendors by VendorBank join.
    // If no bankId, only SUPER_ADMIN may list all vendors (store users can still list
    // by store/user assignment for fallback UX).
    const bankId = searchParams.get("bankId");
    let bankVendorWhere: any;
    let bankIdInt: number | null = null;
    if (bankId) {
      bankIdInt = parseInt(bankId, 10);
      if (isNaN(bankIdInt) || bankIdInt <= 0) {
        return NextResponse.json({ error: "Invalid bankId" }, { status: 400 });
      }

      // STORE_USER / USER can only query vendors for banks that belong to their store.
      if ((isStoreUser || isPlainUser) && ctx.storeId !== null) {
        const storeId = ctx.storeId;
        const storeOwnsBank = await prisma.storeBank.findUnique({
          where: { storeId_bankId: { storeId, bankId: bankIdInt } },
          select: { id: true },
        });
        const legacyStoreOwnsBank = await prisma.bank.findFirst({
          where: { id: bankIdInt, store_id: storeId },
          select: { id: true },
        });
        if (!storeOwnsBank && !legacyStoreOwnsBank) {
          return NextResponse.json(
            { error: "Forbidden: bankId is not assigned to your store" },
            { status: 403 }
          );
        }
      }

      bankVendorWhere = { VendorBank: { some: { bank_id: bankIdInt } } };
    } else if (!isSuperAdmin && !(isStoreUser || isPlainUser)) {
      return NextResponse.json({ error: "Forbidden: bankId required" }, { status: 403 });
    }

    // Option B: a store-scoped user can see a vendor if ANY of these are true:
    // - vendor assigned to the selected bank
    // - vendor assigned to the user
    // - vendor assigned to the user's store (via any bank belonging to that store)
    const userVendorWhere =
      (isStoreUser || isPlainUser) ? { userVendors: { some: { user_id: ctx.userId } } } : undefined;

    const storeVendorWhere =
      (isStoreUser || isPlainUser) && ctx.storeId !== null
        ? {
            VendorBank: {
              some: {
                Bank: {
                  OR: [
                    { store_id: ctx.storeId },
                    { storeBanks: { some: { storeId: ctx.storeId } } },
                  ],
                },
              },
            },
          }
        : undefined;

    const visibilityOr =
      (isStoreUser || isPlainUser)
        ? [bankVendorWhere, userVendorWhere, storeVendorWhere].filter(Boolean)
        : [bankVendorWhere].filter(Boolean);

    const where: any = searchWhere
      ? visibilityOr.length > 0
        ? { AND: [searchWhere, { OR: visibilityOr }] }
        : searchWhere
      : visibilityOr.length > 0
      ? { OR: visibilityOr }
      : undefined;

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
