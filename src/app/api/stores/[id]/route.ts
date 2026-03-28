import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const prismaUnsafe = prisma as any;

// Helper to verify user has access to store
async function verifyStoreAccess(request: NextRequest, storeId: number): Promise<{ authorized: boolean; role?: string }> {
  try {
    // Extract token
    const authHeader = request.headers.get('authorization');
    let token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : '';

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.split('; ').find((c) => c.startsWith('auth-token='));
      if (match) token = match.split('=')[1] || '';
    }

    if (!token) {
      return { authorized: false };
    }

    // Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production') as {
      userId?: number;
      role?: string;
    };

    if (!decoded || !decoded.userId) {
      return { authorized: false };
    }

    // SUPER_ADMIN has access to all stores
    if (decoded.role === 'SUPER_ADMIN') {
      return { authorized: true, role: decoded.role };
    }

    // Check if user's assigned store matches requested store
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { store_id: true }
    });

    return { authorized: user?.store_id === storeId, role: decoded.role };
  } catch (error) {
    console.error('Store access verification error:', error);
    return { authorized: false };
  }
}

// GET /api/stores/[id] - Get store by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    // Verify user has access to this store
    const access = await verifyStoreAccess(request, storeId);
    if (!access.authorized) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to this store' }, { status: 403 });
    }

    const store = await prismaUnsafe.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json(store);
  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 });
  }
}

// PUT /api/stores/[id] - Update store
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    // Verify user has access to this store
    const access = await verifyStoreAccess(request, storeId);
    if (!access.authorized) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to this store' }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, phone } = body;

    const store = await prismaUnsafe.store.update({
      where: { id: storeId },
      data: {
        name,
        address,
        phone,
      },
    });

    return NextResponse.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

// DELETE /api/stores/[id] - Delete store
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 });
    }

    // Verify user has access to this store (only SUPER_ADMIN should delete stores)
    const access = await verifyStoreAccess(request, storeId);
    if (!access.authorized || access.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Super Admin can delete stores' }, { status: 403 });
    }

    await prismaUnsafe.store.delete({
      where: { id: storeId },
    });

    return NextResponse.json({ message: 'Store deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
  }
}
