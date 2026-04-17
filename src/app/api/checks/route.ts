import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { jsonGuardError, requireAuth } from '@/lib/guards';
import { dollarsToCents, centsToDecimal } from '@/lib/money';

export const runtime = 'nodejs';

/**
 * Extract numeric digits from store code.
 * Examples: "58" => 58, "126" => 126, "QT 58" => 58
 */
function parseStoreDigits(code: string): number {
  const match = code.match(/\d+/);
  if (!match) throw new Error(`Invalid store code: ${code}`);
  const digits = parseInt(match[0], 10);
  if (digits < 1) throw new Error(`Store code must contain positive number: ${code}`);
  return digits;
}

/**
 * Allocate next check number for store using transaction-safe sequence.
 * Formula: checkNumber = storeDigits * 10000 + nextNumber
 */
async function allocateCheckNumber(storeId: number): Promise<bigint> {
  return await prisma.$transaction(async (tx) => {
    // Load store to get code
    const store = await tx.store.findUnique({
      where: { id: storeId },
      select: { code: true },
    });
    
    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }
    
    const storeDigits = parseStoreDigits(store.code);
    
    // Upsert sequence: create if not exists, then increment
    const sequence = await tx.storeCheckSequence.upsert({
      where: { storeId },
      create: { storeId, nextNumber: 1 },
      update: {},
      select: { nextNumber: true },
    });
    
    const currentNumber = sequence.nextNumber;
    
    // Increment for next check
    await tx.storeCheckSequence.update({
      where: { storeId },
      data: { nextNumber: currentNumber + 1 },
    });
    
    // Compute final check number
    const checkNumber = BigInt(storeDigits * 10000 + currentNumber);
    
    return checkNumber;
  });
}

// GET /api/checks - Get all checks
export async function GET(request: NextRequest) {
  try {
    // ✅ AUTHENTICATION: Require valid token and get user context
    const ctx = await requireAuth(request);
    console.log('[GET /api/checks] Auth context:', { userId: ctx.userId, role: ctx.role, storeId: ctx.storeId });

    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    const isOfficeAdmin = ctx.role === 'OFFICE_ADMIN' || ctx.role === 'ADMIN';
    const isBackOffice = ctx.role === 'BACK_OFFICE';
    const isStoreRestrictedUser = ctx.role === 'USER' || ctx.role === 'STORE_USER';
    const isAdminLike = isSuperAdmin || isOfficeAdmin || isBackOffice;

    // ✅ STORE SCOPING: Enforce store access
    if (isStoreRestrictedUser && ctx.storeId === null) {
      console.log('[GET /api/checks] User has no store assigned - returning 403');
      return NextResponse.json(
        { error: 'Forbidden', message: 'No store assigned to user' },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendorId');
    const storeId = searchParams.get('storeId');
    const bankIdParam = searchParams.get('bankId');

    // Parse and validate bankId
    const bankIdNum = bankIdParam ? parseInt(bankIdParam, 10) : null;

    // ✅ AUTHORIZATION: Get allowed bank IDs for this user
    // - SUPER_ADMIN / OFFICE_ADMIN / BACK_OFFICE: all banks (reporting/check ops across stores)
    // - Store-restricted users: only banks assigned to their store
    let allowedBankIds: number[] | null = null;
    
    if (!isAdminLike) {
      // For non-admin users, get banks via StoreBank join table + legacy bank.store_id
      if (ctx.storeId) {
        const storeBankRows = await prisma.storeBank.findMany({
          where: { storeId: ctx.storeId },
          select: { bankId: true },
        });
        const legacyBankRows = await prisma.bank.findMany({
          where: { store_id: ctx.storeId },
          select: { id: true },
        });

        const allowed = new Set<number>();
        for (const sb of storeBankRows) allowed.add(sb.bankId);
        for (const b of legacyBankRows) allowed.add(b.id);
        allowedBankIds = Array.from(allowed);
      } else {
        // User has no store assigned - return empty result
        return NextResponse.json({ rows: [], total: 0, checks: [] });
      }
    }

    // Build where clause using parts array (cleaner AND logic)
    const whereParts: Prisma.CheckWhereInput[] = [];

    // 1. Apply bankId filter if provided (both admin and non-admin)
    if (bankIdParam && !isNaN(bankIdNum!)) {
      whereParts.push({ bank_id: bankIdNum });
    }

    // 2. Apply storeId filter if provided
    if (storeId) {
      const storeIdInt = parseInt(storeId, 10);
      if (!isNaN(storeIdInt)) {
        whereParts.push({ store_id: storeIdInt });
      }
    }

    // 3. Apply bank authorization filter for non-admin users
    if (allowedBankIds !== null) {
      // If bankId was specified, verify it's in allowed list
      if (bankIdNum && !allowedBankIds.includes(bankIdNum)) {
        return NextResponse.json({ 
          error: 'Forbidden', 
          message: 'You do not have access to this bank' 
        }, { status: 403 });
      }
      
      // If no specific bankId requested, filter to allowed banks
      // Note: Empty array is OK - store might not have banks yet
      if (!bankIdNum && allowedBankIds.length > 0) {
        whereParts.push({ bank_id: { in: allowedBankIds } });
      }
    }

    // 4. Apply store authorization filter for non-SUPER_ADMIN users
    if (isStoreRestrictedUser) {
      const userStoreId = ctx.storeId!; // Already validated above
      
      // If storeId param provided, verify access
      if (storeId) {
        const storeIdInt = parseInt(storeId, 10);
        if (!isNaN(storeIdInt) && storeIdInt !== userStoreId) {
          console.log('[GET /api/checks] Access denied to store', storeIdInt, '- user only has access to', userStoreId);
          return NextResponse.json({ 
            error: 'Forbidden', 
            message: 'You do not have access to this store' 
          }, { status: 403 });
        }
      }
      
      // Always filter to user's store for non-SUPER_ADMIN
      whereParts.push({ store_id: userStoreId });
      console.log('[GET /api/checks] Filtering to user store:', userStoreId);
    } else if ((isSuperAdmin || isAdminLike) && storeId) {
      // SUPER_ADMIN can optionally filter by storeId param
      const storeIdInt = parseInt(storeId, 10);
      if (!isNaN(storeIdInt)) {
        whereParts.push({ store_id: storeIdInt });
      }
    }

    // 5. Build search terms for check-level fields
    if (search) {
      const searchTerms: Prisma.CheckWhereInput[] = [];
      
      // Check-level search
      searchTerms.push({ memo: { contains: search, mode: 'insensitive' } });
      searchTerms.push({ payee_name: { contains: search, mode: 'insensitive' } });

      const numericSearch = Number(search);
      if (!Number.isNaN(numericSearch)) {
        searchTerms.push({ check_number: BigInt(Math.trunc(numericSearch)) });
      }

      // Bank name/DBA search
      searchTerms.push({ Bank: { dba: { contains: search, mode: 'insensitive' } } });
      searchTerms.push({ Bank: { bank_name: { contains: search, mode: 'insensitive' } } });

      // Add search as OR condition
      whereParts.push({ OR: searchTerms });
    }

    // 6. Build final where clause
    const where: Prisma.CheckWhereInput = whereParts.length === 0 
      ? {} 
      : whereParts.length === 1 
        ? whereParts[0] 
        : { AND: whereParts };

    // Status, vendorId, and storeId filters are not supported in current schema
    // Note: The Check model doesn't have status, vendor, or store fields
    // These filters are ignored for now

    const [checks, total] = await Promise.all([
      prisma.check.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          created_at: true,
          check_number: true,
          payment_method: true,
          status: true,
          amount: true,
          memo: true,
          payee_name: true,
          invoice_url: true,
          store_id: true,
          Vendor: {
            select: {
              id: true,
              vendor_name: true,
              vendor_type: true,
            },
          },
          Store: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
            },
          },
          issued_by_username: true,
          Bank: {
            select: {
              id: true,
              bank_name: true,
              dba: true,
              account_type: true,
              routing_number: true,
              account_number: true,
              signature_url: true,
              BankSigner: {
                where: { is_default: true },
                select: {
                  Signer: {
                    select: {
                      Signature: {
                        where: { is_active: true },
                        orderBy: { uploaded_at: 'desc' },
                        take: 1,
                        select: { url: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.check.count({ where })
    ]);

    const payload = checks.map((check) => ({
      id: check.id.toString(),
      createdAt: check.created_at,
      created_at: check.created_at, // Include both formats for compatibility
      checkNumber: check.check_number != null ? Number(check.check_number) : null,
      check_number: check.check_number != null ? Number(check.check_number) : null, // Include both formats for compatibility
      bank: {
        id: check.Bank.id.toString(),
        bankName: check.Bank.bank_name,
        dba: check.Bank.dba,
        accountType: check.Bank.account_type,
        routingNumber: check.Bank.routing_number?.toString() || null,
        accountNumber: check.Bank.account_number?.toString() || null,
        signatureUrl:
          check.Bank.signature_url ||
          check.Bank.BankSigner?.[0]?.Signer?.Signature?.[0]?.url ||
          null,
      },
      dba: check.Bank.dba ?? null, // DBA at top level for easy access
      amount: check.amount ? Number(check.amount) : 0,
      memo: check.memo ?? null,
      payeeName: check.Vendor?.vendor_name ?? check.payee_name ?? null,
      payee_name: check.Vendor?.vendor_name ?? check.payee_name ?? null, // Include both formats for compatibility
      status: check.status ?? 'PENDING',
      paymentMethod: check.payment_method ?? 'CHECK',
      payment_method: check.payment_method ?? 'CHECK', // Include both formats for compatibility
      invoiceUrl: check.invoice_url ?? null,
      invoice_url: check.invoice_url ?? null,
      vendor: check.Vendor
        ? {
            id: check.Vendor.id.toString(),
            vendorName: check.Vendor.vendor_name,
            vendorType: check.Vendor.vendor_type,
          }
        : check.payee_name
        ? {
            vendorName: check.payee_name,
          }
        : null,
      store: check.Store
        ? {
            id: check.Store.id.toString(),
            name: check.Store.name,
            address: check.Store.address ?? null,
            phone: check.Store.phone ?? null,
          }
        : null,
      storeId: check.store_id?.toString() ?? null,
      storeName: check.Store?.name ?? null,
      issuedByUser: {
        username: check.issued_by_username ?? 'Unknown',
      },
      userName: check.issued_by_username ?? 'Unknown',
    }));

    return NextResponse.json({ 
      rows: payload, 
      total,
      checks: payload // Backward compatibility
    });
  } catch (error) {
    if (typeof (error as any)?.status === 'number') {
      return jsonGuardError(error);
    }
    console.error('Error fetching checks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined;
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      ...(errorStack && { stack: errorStack })
    } : { error: String(error) };
    
    return NextResponse.json({ 
      error: 'Failed to fetch checks',
      message: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}

// POST /api/checks - Create a new check
export async function POST(request: NextRequest) {
  try {
    // ✅ AUTHENTICATION: Require valid token and get user context
    const ctx = await requireAuth(request);
    console.log('[POST /api/checks] Auth context:', { userId: ctx.userId, role: ctx.role, storeId: ctx.storeId });

    // ✅ AUTHORIZATION: Back Office is view-only
    if (ctx.role === 'BACK_OFFICE') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Back Office role cannot create checks' },
        { status: 403 }
      );
    }

    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    const isOfficeAdmin = ctx.role === 'OFFICE_ADMIN' || ctx.role === 'ADMIN';
    const isStoreRestrictedUser = ctx.role === 'USER' || ctx.role === 'STORE_USER';
    const issuedByUsername = ctx.username;

    const body = await request.json();
    const {
      bankId,
      amount,
      memo,
      payeeName,
      vendorId,
      storeId,
      paymentMethod: rawMethod,
    } = body || {};

    // Normalize payment method to a consistent stored value
    const normalizedMethod: string =
      rawMethod === 'Cheque' || rawMethod === 'CHECK' ? 'CHECK' :
      rawMethod === 'Cash'   || rawMethod === 'CASH'  ? 'CASH'  :
      (typeof rawMethod === 'string' && rawMethod.length > 0) ? rawMethod : 'CHECK';
    const isCheckPayment = normalizedMethod === 'CHECK';

    const vendorIdInt = vendorId ? parseInt(vendorId, 10) : null;
    if (vendorId && Number.isNaN(vendorIdInt)) {
      return NextResponse.json({ error: 'Invalid vendorId' }, { status: 400 });
    }

    const storeIdInt = storeId ? parseInt(storeId, 10) : null;
    if (!storeIdInt || Number.isNaN(storeIdInt)) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    // ✅ STORE SCOPING: Verify user has access to this store
    if (isStoreRestrictedUser) {
      if (ctx.storeId === null) {
        console.log('[POST /api/checks] User has no store assigned - returning 403');
        return NextResponse.json({
          error: 'Forbidden',
          message: 'No store assigned to user'
        }, { status: 403 });
      }
      
      if (ctx.storeId !== storeIdInt) {
        console.log('[POST /api/checks] Access denied to store', storeIdInt, '- user only has access to', ctx.storeId);
        return NextResponse.json({
          error: 'Forbidden',
          message: 'You do not have access to create checks for this store'
        }, { status: 403 });
      }
    } else if (!isSuperAdmin && !isOfficeAdmin) {
      // Any other role must be explicitly accounted for
      return NextResponse.json(
        { error: 'Forbidden', message: 'Role not permitted to create checks' },
        { status: 403 }
      );
    }

    if (!bankId) {
      return NextResponse.json({ error: 'bankId is required' }, { status: 400 });
    }

    // ✅ BANK-STORE OWNERSHIP: Verify the bank belongs to the target store
    const bankIdNum = Number(bankId);
    const storeOwnsBank = await prisma.storeBank.findUnique({
      where: { storeId_bankId: { storeId: storeIdInt, bankId: bankIdNum } },
      select: { id: true },
    });
    const legacyStoreOwnsBank = await prisma.bank.findFirst({
      where: { id: bankIdNum, store_id: storeIdInt },
      select: { id: true },
    });
    if (!storeOwnsBank && !legacyStoreOwnsBank) {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'The selected bank is not assigned to this store',
      }, { status: 403 });
    }

    // Convert amount to cents to avoid floating-point rounding errors
    let amountCents: number;
    try {
      amountCents = dollarsToCents(amount);
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid amount', 
        details: error instanceof Error ? error.message : 'Amount must be a valid number'
      }, { status: 400 });
    }

    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    // Role-based max amount enforcement (CHECK payments only)
    if (isCheckPayment) {
      const ROLE_LIMITS: Record<string, number | null> = {
        USER: 200_000,   // $2,000.00
        ADMIN: 500_000,  // $5,000.00
        SUPER_ADMIN: null,
      };
      const maxCents = ROLE_LIMITS[ctx.role] ?? null;
      if (maxCents !== null && amountCents > maxCents) {
        const maxDollars = (maxCents / 100).toFixed(2);
        const attemptedDollars = (amountCents / 100).toFixed(2);
        return NextResponse.json({
          error: `Amount exceeds limit for your role (${ctx.role}). Maximum allowed: $${maxDollars}. Attempted: $${attemptedDollars}.`,
        }, { status: 400 });
      }
    }

    // Fetch vendor name if vendorId is provided
    let finalPayeeName = payeeName;
    if (vendorIdInt && !payeeName) {
      try {
        const vendor = await prisma.vendor.findUnique({
          where: { id: vendorIdInt },
          select: { vendor_name: true },
        });
        if (vendor) {
          finalPayeeName = vendor.vendor_name;
        }
      } catch (e) {
        console.warn('Failed to fetch vendor name:', e);
      }
    }

    // Allocate check number only for CHECK payments
    const checkNumber = isCheckPayment ? await allocateCheckNumber(storeIdInt) : null;

    const created = await prisma.check.create({
      data: {
        check_number: checkNumber,
        payment_method: normalizedMethod,
        status: 'PENDING',
        bank_id: Number(bankId),
        vendor_id: vendorIdInt,
        store_id: storeIdInt,
        amount: new Prisma.Decimal(centsToDecimal(amountCents)),
        memo: memo ?? null,
        payee_name: finalPayeeName ?? null,
        issued_by_username: issuedByUsername,
      },
      include: {
        Bank: {
          select: {
            id: true,
            bank_name: true,
            dba: true,
            account_type: true,
          },
        },
        Store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: created.id.toString(),
        checkNumber: created.check_number != null ? Number(created.check_number) : null,
        bankId: created.Bank.id.toString(),
        storeId: created.Store?.id?.toString() ?? null,
        storeName: created.Store?.name ?? null,
        amount: created.amount ? Number(created.amount) : 0,
        memo: created.memo ?? null,
        payeeName: created.payee_name ?? null,
        invoiceUrl: created.invoice_url ?? null,
        paymentMethod: normalizedMethod,
        status: 'PENDING',
        createdAt: created.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    if (typeof (error as any)?.status === 'number') {
      return jsonGuardError(error);
    }
    console.error('Error creating check:', error);
    return NextResponse.json({ 
      error: 'Failed to create check',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
