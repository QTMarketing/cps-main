import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { Role } from '@/lib/rbac';
import { requireAuth, type GuardContext } from '@/lib/guards';
import { hasAWSConfig, putInvoice } from '@/lib/signatureStorage';

export const runtime = 'nodejs';

function toBigInt(value: unknown, field: string): bigint | { error: string } {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
    if (typeof value === 'string' && value.trim() !== '') {
      if (!/^\d+$/.test(value.trim())) {
        return { error: `${field} must contain only digits` };
      }
      return BigInt(value.trim());
    }
    return { error: `${field} is required` };
  } catch {
    return { error: `${field} is invalid` };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// BankPayload type matches Prisma schema field names (snake_case)
// Note: API accepts camelCase (storeId) but maps to relation connect for Prisma.
// store_id is kept here only for auth/validation logic before the create call;
// it is converted to Store: { connect: { id } } and deleted before hitting Prisma.
type BankPayload = {
  bank_name: string;
  account_number: bigint;
  routing_number: bigint;
  return_address: string | null;
  return_city: string | null;
  return_state: string | null;
  return_zip: bigint | null;
  account_name: string | null;
  dba: string | null;
  signature_name: string | null;
  account_type: string;
  signature_url: string | null;
  store_id?: number | null;  // Auth/validation only — NOT passed to Prisma directly
  Store?: {
    connect: { id: number };
  };
  Corporation?: {
    connect: { id: number };
  };
};

type SignerPayload = {
  full_name: string;
  is_default: boolean;
  file_field: string;
};

// Use /tmp in serverless environments (Vercel, Lambda) where filesystem is read-only
const SIGNATURE_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? '/tmp/uploads/signatures'
  : path.join(process.cwd(), 'public', 'uploads', 'signatures');

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.split('; ').find((item) => item.startsWith('auth-token='));
    if (match) {
      return match.split('=')[1] ?? null;
    }
  }

  return null;
}

function validateBankPayload(body: any): { data?: BankPayload; error?: string } {
  if (body == null || typeof body !== 'object') {
    return { error: 'Bank payload must be an object' };
  }

  const required = [
    'bank_name',
    'account_number',
    'routing_number',
    'account_type',
  ] as const;

  for (const key of required) {
    if (!isNonEmptyString(body[key])) {
      return { error: `${key} is required` };
    }
  }

  // Optional fields that can be null
  const optionalFields = [
    'return_address',
    'return_city',
    'return_state',
    'return_zip',
    'account_name',
    'dba',
    'signature_name',
  ] as const;

  // Validate account_type
  const validAccountTypes = ['CHECKING', 'SAVINGS', 'BUSINESS'];
  if (!validAccountTypes.includes(body.account_type)) {
    return { error: 'account_type must be one of: CHECKING, SAVINGS, BUSINESS' };
  }

  const accountNumber = toBigInt(body.account_number, 'account_number');
  if (typeof accountNumber !== 'bigint') return accountNumber;

  const routingNumber = toBigInt(body.routing_number, 'routing_number');
  if (typeof routingNumber !== 'bigint') return routingNumber;

  // return_zip is optional, only validate if provided
  let returnZip: bigint | null = null;
  if (body.return_zip != null && body.return_zip !== '') {
    const zipResult = toBigInt(body.return_zip, 'return_zip');
    if (typeof zipResult !== 'bigint') return zipResult;
    returnZip = zipResult;
  }

  let corporationId: number | null = null;
  if (body.corporation_id != null && body.corporation_id !== '') {
    const parsed =
      typeof body.corporation_id === 'number'
        ? body.corporation_id
        : Number(body.corporation_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: 'corporation_id must be a positive integer' };
    }
    corporationId = parsed;
  }

  // Validate and parse store_id if provided
  // Note: Frontend sends camelCase (storeId), but Prisma schema uses snake_case (store_id)
  // We accept camelCase from API and map it to snake_case for database
  let storeId: number | null = null;
  if (body.storeId != null && body.storeId !== '') {
    const parsed = typeof body.storeId === 'number'
      ? body.storeId
      : typeof body.storeId === 'string'
      ? parseInt(body.storeId, 10)
      : NaN;
    
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: 'storeId must be a positive integer' };
    }
    storeId = parsed;
  }

  const data: BankPayload = {
    bank_name: body.bank_name.trim(),
    account_number: accountNumber,
    routing_number: routingNumber,
    account_type: body.account_type,
    return_address: body.return_address ? body.return_address.trim() : null,
    return_city: body.return_city ? body.return_city.trim() : null,
    return_state: body.return_state ? body.return_state.trim() : null,
    return_zip: returnZip,
    account_name: body.account_name ? body.account_name.trim() : null,
    dba: body.dba ? body.dba.trim() : null,
    signature_name: body.signature_name ? body.signature_name.trim() : null,
    signature_url: null,
    store_id: storeId,
  };

  if (corporationId) {
    data.Corporation = {
      connect: { id: corporationId },
    };
  }

  return { data };
}

function validateSignersPayload(raw: any): { data?: SignerPayload[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'At least one signatory is required' };
  }

  const parsed: SignerPayload[] = [];
  raw.forEach((item, index) => {
    if (typeof item !== 'object' || item == null) {
      return;
    }

    const fullName = typeof item.full_name === 'string' ? item.full_name.trim() : '';
    if (!fullName) {
      parsed.push({ full_name: '', is_default: false, file_field: '' });
      return;
    }

    const fileField = typeof item.file_field === 'string' ? item.file_field.trim() : '';
    if (!fileField) {
      parsed.push({ full_name: fullName, is_default: false, file_field: '' });
      return;
    }

    parsed.push({
      full_name: fullName,
      is_default: Boolean(item.is_default),
      file_field: fileField,
    });
  });

  const invalidIndex = parsed.findIndex(
    (item) => !item.full_name || !item.file_field,
  );
  if (invalidIndex >= 0) {
    return { error: `Signer at position ${invalidIndex + 1} is invalid` };
  }

  return { data: parsed };
}

function decodeAndAuthorize(request: NextRequest): { userId: number | null; role: Role } | { error: NextResponse } {
  const token = extractToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    ) as {
      userId?: number;
      role?: Role;
    };

    if (!decoded || !decoded.role) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    return {
      userId: decoded.userId ?? null,
      role: decoded.role,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}

export async function GET(request: NextRequest) {
  const auth = decodeAndAuthorize(request);
  if ('error' in auth) {
    return auth.error;
  }

  // Only SUPER_ADMIN can view banks (Office Admins must not access bank management)
  if (auth.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Forbidden: Only Super Admin can view banks' }, { status: 403 });
  }

  // DIAGNOSTIC: Log database info (safe - no password)
  const dbUrl = process.env.DATABASE_URL || '';
  const dbMatch = dbUrl.match(/@([^/]+)\/([^?]+)/);
  if (dbMatch) {
    console.log('[GET /api/banks] Database:', { host: dbMatch[1], database: dbMatch[2] });
  }

  try {
    // ✅ AUTHORIZATION: Filter banks by user's assigned store (non-SUPER_ADMIN only)
    let whereClause: Prisma.BankWhereInput = {};
    
    if (auth.role !== Role.SUPER_ADMIN && auth.userId) {
      // Fetch user's assigned store
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { store_id: true }
      });
      const userStoreId = user?.store_id;
      
      if (userStoreId === null || userStoreId === undefined) {
        // User has no assigned store - return empty result
        return NextResponse.json([]);
      }
      
      // Filter to banks belonging to user's store (or banks with no store_id)
      whereClause = {
        OR: [
          { store_id: userStoreId },
          { store_id: null }, // Include banks not assigned to any store
        ],
      };
    }

    const banks = await prisma.bank.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: {
        Corporation: true,
        BankSigner: {
          include: {
            Signer: {
              include: {
                Signature: {
                  where: { is_active: true },
                  orderBy: { uploaded_at: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // DIAGNOSTIC LOGS
    console.log('[GET /api/banks] Raw count from DB:', banks.length);
    if (banks.length > 0) {
      console.log('[GET /api/banks] First bank from DB:', {
        id: banks[0].id,
        dba: banks[0].dba,
        bank_name: banks[0].bank_name,
      });
      console.log('[GET /api/banks] Last bank from DB:', {
        id: banks[banks.length - 1].id,
        dba: banks[banks.length - 1].dba,
        bank_name: banks[banks.length - 1].bank_name,
      });
    }

    const payload = banks.map((bank) => {
      return {
        id: bank.id,
        bank_name: bank.bank_name,
        account_number: bank.account_number.toString(),
        routing_number: bank.routing_number.toString(),
        account_name: bank.account_name,
        dba: bank.dba,
        signature_name: bank.signature_name,
        signature_url: bank.signature_url || null,
        return_address: bank.return_address,
        return_city: bank.return_city,
        return_state: bank.return_state,
        return_zip: bank.return_zip ? bank.return_zip.toString() : null,
        created_at: bank.created_at,
        account_type: bank.account_type,
        corporation: bank.Corporation
          ? {
              id: bank.Corporation.id,
              name: bank.Corporation.name,
              owner: bank.Corporation.owner,
              ein: bank.Corporation.ein,
            }
          : null,
        signers: bank.BankSigner.map((link) => ({
          id: link.Signer.id,
          full_name: link.Signer.full_name,
          is_default: link.is_default,
          signature: link.Signer.Signature.length
            ? {
                url: link.Signer.Signature[0].url,
                mime_type: link.Signer.Signature[0].mime_type,
              }
            : null,
        })),
      };
    });

    console.log('[GET /api/banks] Payload count after mapping:', payload.length);
    if (payload.length > 0) {
      console.log('[GET /api/banks] First payload item:', {
        id: payload[0].id,
        dba: payload[0].dba,
        bank_name: payload[0].bank_name,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching banks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch banks',
        message: errorMessage,
        ...(errorStack && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = decodeAndAuthorize(request);
  if ('error' in auth) {
    return auth.error;
  }

  // Only SUPER_ADMIN can create banks
  if (auth.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Forbidden: Only Super Admin can create banks' }, { status: 403 });
  }

  // Get user context for store scoping
  const ctx = await requireAuth(request);
  const isSuperAdmin = ctx.role === 'SUPER_ADMIN';

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    return handleMultipartRequest(request, auth.userId, ctx);
  }

  try {
    const body = await request.json().catch(() => null);
    const { data, error } = validateBankPayload(body);

    if (error || !data) {
      return NextResponse.json({ error }, { status: 400 });
    }

    // ✅ STORE AUTHORIZATION LOGIC
    if (isSuperAdmin) {
      // SUPER_ADMIN must provide storeId
      if (!data.store_id) {
        return NextResponse.json(
          { error: 'storeId is required for bank creation' },
          { status: 400 }
        );
      }
      
      // Validate store exists
      const storeExists = await prisma.store.findUnique({
        where: { id: data.store_id },
      });
      
      if (!storeExists) {
        return NextResponse.json(
          { error: 'Invalid storeId: Store not found' },
          { status: 400 }
        );
      }
      
      console.log('[POST /api/banks] SUPER_ADMIN creating bank for store:', data.store_id);
    } else {
      // Non-SUPER_ADMIN: force store_id to user's assigned store
      if (ctx.storeId === null) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'No store assigned to user' },
          { status: 403 }
        );
      }
      
      // Override any provided storeId with user's store
      data.store_id = ctx.storeId;
      
      console.log('[POST /api/banks] ADMIN creating bank for their store:', ctx.storeId);
    }

    // Debug log before create
    console.log('[POST /api/banks] Creating bank with:', {
      store_id: data.store_id,
      store_id_type: typeof data.store_id,
      hasStoreRelation: ('Store' in data),
      allKeys: Object.keys(data).filter(k => !['account_number', 'routing_number'].includes(k))
    });

    // Convert store_id FK to Store relation connect (Prisma requires relation form when
    // Corporation also uses relation form — cannot mix checked/unchecked inputs).
    const resolvedStoreId = data.store_id;
    delete data.store_id;
    if (resolvedStoreId) {
      data.Store = { connect: { id: resolvedStoreId } };
    }

    // DIAGNOSTIC: Log data keys and store_id value
    console.log("[BANK CREATE] data keys:", Object.keys(data));
    console.log("[BANK CREATE] Store present:", 'Store' in data, "store_id present:", 'store_id' in data);

    const bank = await prisma.bank.create({ data });
    console.log('[POST /api/banks] Bank created with store_id:', bank.store_id);
    
    return NextResponse.json(bank, { status: 201 });
  } catch (error) {
    console.error('Error creating bank:', error);
    return NextResponse.json(
      { error: 'Failed to create bank' },
      { status: 500 }
    );
  }
}

async function handleMultipartRequest(request: NextRequest, userId: number | null, ctx: GuardContext) {
  try {
    const formData = await request.formData();
    const bankRaw = formData.get('bank');
    const signersRaw = formData.get('signers');

    if (typeof bankRaw !== 'string') {
      return NextResponse.json({ error: 'Missing bank payload' }, { status: 400 });
    }
    if (typeof signersRaw !== 'string') {
      return NextResponse.json({ error: 'Missing signers payload' }, { status: 400 });
    }

    const bankPayload = JSON.parse(bankRaw);
    const signersPayload = JSON.parse(signersRaw);

    const { data: bankData, error: bankError } = validateBankPayload(bankPayload);
    if (bankError || !bankData) {
      return NextResponse.json({ error: bankError }, { status: 400 });
    }

    const { data: signersMeta, error: signerError } = validateSignersPayload(signersPayload);
    if (signerError || !signersMeta) {
      return NextResponse.json({ error: signerError }, { status: 400 });
    }

    // ✅ STORE AUTHORIZATION LOGIC
    const isSuperAdmin = ctx.role === 'SUPER_ADMIN';
    
    if (isSuperAdmin) {
      // SUPER_ADMIN must provide storeId
      if (!bankData.store_id) {
        return NextResponse.json(
          { error: 'storeId is required for bank creation' },
          { status: 400 }
        );
      }
      
      // Validate store exists
      const storeExists = await prisma.store.findUnique({
        where: { id: bankData.store_id },
      });
      
      if (!storeExists) {
        return NextResponse.json(
          { error: 'Invalid storeId: Store not found' },
          { status: 400 }
        );
      }
      
      console.log('[POST /api/banks multipart] SUPER_ADMIN creating bank for store:', bankData.store_id);
    } else {
      // Non-SUPER_ADMIN: force store_id to user's assigned store
      if (ctx.storeId === null) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'No store assigned to user' },
          { status: 403 }
        );
      }
      
      // Override any provided storeId with user's store
      bankData.store_id = ctx.storeId;
      
      console.log('[POST /api/banks multipart] ADMIN creating bank for their store:', ctx.storeId);
    }

  const defaultCount = signersMeta.filter((meta) => meta.is_default).length;
  if (defaultCount !== 1) {
    return NextResponse.json(
      { error: 'Exactly one signatory must be marked as default' },
      { status: 400 },
    );
  }

    const signerFiles = await Promise.all(
      signersMeta.map(async (meta) => {
        const file = formData.get(meta.file_field);
        if (!(file instanceof File)) {
          throw new Error(`Missing signature file for ${meta.full_name}`);
        }

        if (!file.type?.startsWith('image/')) {
          throw new Error(`Signature for ${meta.full_name} must be an image`);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const extension = path.extname(file.name) || (file.type === 'image/png' ? '.png' : '.jpg');
        const filename = `${randomUUID()}${extension}`;
        const storageKey = path.posix.join('bank', filename);
        const localFilePath = path.join(SIGNATURE_DIR, filename);

        const mimeType = file.type || 'application/octet-stream';

        if (hasAWSConfig) {
          const sigExt = mimeType === 'image/png' ? 'png' : 'jpg';
          const s3Key = `signatures/${randomUUID()}.${sigExt}`;
          await putInvoice({ key: s3Key, fileBytes: buffer, contentType: mimeType });
          return {
            meta,
            storageKey: s3Key,
            url: s3Key,
            mimeType,
          };
        }

        await fs.mkdir(SIGNATURE_DIR, { recursive: true });
        await fs.writeFile(localFilePath, buffer);

        return {
          meta,
          storageKey,
          url: `/uploads/signatures/${filename}`,
          mimeType,
        };
      }),
    );

    // Convert store_id FK to Store relation connect before entering the transaction.
    // Prisma requires a consistent input form: since Corporation uses relation form,
    // Store must also use relation form (cannot mix checked/unchecked inputs).
    const resolvedStoreId = bankData.store_id;
    delete bankData.store_id;
    if (resolvedStoreId) {
      bankData.Store = { connect: { id: resolvedStoreId } };
    }

    console.log('[POST /api/banks multipart] Pre-transaction bankData keys:', Object.keys(bankData));
    console.log('[POST /api/banks multipart] Store present:', 'Store' in bankData, "store_id present:", 'store_id' in bankData);

    const result = await prisma.$transaction(async (tx) => {
      const defaultSignature = signerFiles.find((file) => file.meta.is_default);

      const txCreateData = {
        ...bankData,
        signature_url: defaultSignature?.url ?? null,
      };

      // Required debug log: confirm store_id is gone and Store is present
      console.log("[BANK CREATE TX] data keys:", Object.keys(txCreateData));
      console.log("[BANK CREATE TX] Store present:", 'Store' in txCreateData, "store_id present:", 'store_id' in txCreateData);

      const bank = await tx.bank.create({
        data: txCreateData,
      });

      const createdSigners: Array<{
        id: number;
        full_name: string;
        is_default: boolean;
        signature_url: string;
      }> = [];

      for (const signerFile of signerFiles) {
        const signerRecord = await tx.signer.create({
          data: {
            full_name: signerFile.meta.full_name,
          },
        });

        await tx.signature.create({
          data: {
            signer_id: signerRecord.id,
            storage_key: signerFile.storageKey,
            url: signerFile.url,
            mime_type: signerFile.mimeType,
            width: null,
            height: null,
            uploaded_by: userId,
          },
        });

        await tx.bankSigner.create({
          data: {
            bank_id: bank.id,
            signer_id: signerRecord.id,
            is_default: signerFile.meta.is_default,
          },
        });

        createdSigners.push({
          id: signerRecord.id,
          full_name: signerRecord.full_name,
          is_default: signerFile.meta.is_default,
          signature_url: signerFile.url,
        });
      }

      return {
        bank,
        signers: createdSigners,
      };
    });

    return NextResponse.json(
      {
        bank: {
          id: result.bank.id,
          bank_name: result.bank.bank_name,
          account_number: result.bank.account_number.toString(),
          routing_number: result.bank.routing_number.toString(),
          account_name: result.bank.account_name,
          dba: result.bank.dba,
          signature_name: result.bank.signature_name,
          return_address: result.bank.return_address,
          return_city: result.bank.return_city,
          return_state: result.bank.return_state,
          return_zip: result.bank.return_zip ? result.bank.return_zip.toString() : null,
          created_at: result.bank.created_at,
        },
        signers: result.signers,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating bank with signers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create bank' },
      { status: 500 },
    );
  }
}
