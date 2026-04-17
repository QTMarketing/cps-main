import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMinimumRole, Role, getUserFromRequest } from '@/lib/rbac';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// GET /api/stores - Get stores based on user role
export async function GET(req: NextRequest) {
  try {
    // Get auth token
    const authHeader = req.headers.get('authorization');
    let token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : '';

    if (!token) {
      const cookieHeader = req.headers.get('cookie') || '';
      const match = cookieHeader.split('; ').find((c) => c.startsWith('auth-token='));
      if (match) token = match.split('=')[1] || '';
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Decode token to get user info
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId?: number;
      role?: Role;
    };

    if (!decoded || typeof decoded.userId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user from DB to ensure we have latest role
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let stores;
    
    console.log('[GET /api/stores] User lookup:', { userId: decoded.userId, role: user.role });
    
    // SUPER_ADMIN sees all stores
    if (user.role === 'SUPER_ADMIN') {
      stores = await prisma.store.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          phone: true,
          status: true,
        },
        orderBy: { code: 'asc' },
      });
    }
    // ADMIN sees all stores (for now - can be restricted later)
    else if (user.role === 'ADMIN') {
      stores = await prisma.store.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          phone: true,
          status: true,
        },
        orderBy: { code: 'asc' },
      });
    }
    // OFFICE_ADMIN can be assigned multiple stores via StoreUser join table
    else if (user.role === 'OFFICE_ADMIN') {
      const assigned = await prisma.storeUser.findMany({
        where: { userId: user.id },
        select: {
          store: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              phone: true,
              status: true,
            },
          },
        },
      });

      const assignedStores = assigned.map((su) => su.store).filter(Boolean);

      // If there are explicit StoreUser assignments, use them; otherwise fall back to 1:1 store_id
      if (assignedStores.length > 0) {
        stores = assignedStores.sort((a, b) => String(a.code).localeCompare(String(b.code)));
      } else {
        const userWithStore = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            store_id: true,
            Store: {
              select: {
                id: true,
                code: true,
                name: true,
                address: true,
                phone: true,
                status: true,
              },
            },
          },
        });
        stores = userWithStore?.Store ? [userWithStore.Store] : [];
      }
    }
    // USER / STORE_USER sees only their assigned store (1:1 model)
    else {
      // Get user's assigned store
      const userWithStore = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          store_id: true,
          Store: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              phone: true,
              status: true,
            },
          },
        },
      });
      
      console.log('[GET /api/stores] USER store lookup:', { 
        userId: user.id, 
        store_id: userWithStore?.store_id,
        hasStore: !!userWithStore?.Store,
        storeName: userWithStore?.Store?.name
      });
      
      // Return single store in array format (or empty if no store assigned)
      stores = userWithStore?.Store ? [userWithStore.Store] : [];
    }

    console.log('[GET /api/stores] Returning stores:', { count: stores.length, stores: stores.map(s => ({ id: s.id, name: s.name, code: s.code })) });

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

// POST /api/stores - Create a new store (Admin only)
export async function POST(req: NextRequest) {
  // Require ADMIN role or higher
  const roleCheck = requireMinimumRole(Role.ADMIN);
  const response = await roleCheck(req);
  
  if (response) {
    return response;
  }

  try {
    const body = await req.json();
    const { code, name, address, phone, status } = body;

    // Validation
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Check if store code already exists
    const existing = await prisma.store.findUnique({
      where: { code: code.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Store with code "${code}" already exists` },
        { status: 400 }
      );
    }

    const store = await prisma.store.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        address: address?.trim() || 'Address TBD',
        phone: phone?.trim() || null,
        status: status || 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('[POST /api/stores] Created store:', { id: store.id, code: store.code, name: store.name });

    return NextResponse.json({ store }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating store:', error);
    
    // Handle unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Store with this code already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}
