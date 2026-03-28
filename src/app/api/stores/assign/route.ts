import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Role } from '@/lib/rbac';
import { z } from 'zod';

const schema = z.object({ userId: z.string().min(1), storeIds: z.array(z.string().min(1)).min(1) });
const prismaUnsafe = prisma as any;

export async function POST(req: NextRequest) {
  const roleCheck = requireRole(Role.ADMIN);
  const response = await roleCheck(req);
  if (response) return response;

  try {
    const body = await req.json();
    const { userId, storeIds } = schema.parse(body);
    await prismaUnsafe.userStore.createMany({ data: storeIds.map(id => ({ userId, storeId: id })), skipDuplicates: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to assign stores', details: e?.message }, { status: 400 });
  }
}



