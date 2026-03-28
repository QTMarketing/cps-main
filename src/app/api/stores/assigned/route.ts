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

    const joins = await prismaUnsafe.userStore.findMany({
      where: { userId },
      include: { store: true },
      orderBy: { store: { name: 'asc' } },
    });

    const filtered = q
      ? joins.filter(j => (j.store?.name || '').toLowerCase().includes(q.toLowerCase()) || (j.store?.address || '').toLowerCase().includes(q.toLowerCase()))
      : joins;

    const stores = filtered.map(j => ({ id: j.storeId, name: j.store?.name || '', address: j.store?.address || '' }));
    return NextResponse.json({ stores });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load assigned stores' }, { status: 500 });
  }
}



