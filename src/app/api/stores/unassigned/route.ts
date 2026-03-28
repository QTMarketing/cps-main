import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Role } from '@/lib/rbac';

const prismaUnsafe = prisma as any;

export async function GET(req: NextRequest) {
  const roleCheck = requireRole(Role.ADMIN);
  const response = await roleCheck(req);
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';
    const q = (searchParams.get('q') || '').trim();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // find store ids already assigned
    const assigned = await prismaUnsafe.userStore.findMany({ where: { userId }, select: { storeId: true } });
    const assignedIds = assigned.map(a => a.storeId);

    const where: any = {};
    if (assignedIds.length) where.id = { notIn: assignedIds };
    if (q) where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
    ];

    const stores = await prismaUnsafe.store.findMany({ where, orderBy: { name: 'asc' } });
    return NextResponse.json({ stores });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load unassigned stores' }, { status: 500 });
  }
}



