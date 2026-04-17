import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Role } from '@/lib/rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require SUPER_ADMIN role
    const roleCheck = requireRole(Role.SUPER_ADMIN);
    const response = await roleCheck(req);
    
    if (response) {
      return response;
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const body = await req.json();
    const { storeId } = body;

    const storeIdInt = parseInt(storeId, 10);
    if (!storeId || isNaN(storeIdInt)) {
      return NextResponse.json({ error: 'Invalid store id' }, { status: 400 });
    }

    // Ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure store exists
    const store = await prisma.store.findUnique({
      where: { id: storeIdInt },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Assign user to store via StoreUser join table
    // Using upsert to handle duplicate assignments gracefully
    const storeUser = await prisma.storeUser.upsert({
      where: {
        userId_storeId: {
          userId: userId,
          storeId: storeIdInt,
        },
      },
      create: {
        userId: userId,
        storeId: storeIdInt,
      },
      update: {}, // If already exists, do nothing
    });

    // Return updated user with assigned stores
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        storeUsers: {
          select: {
            store: {
              select: {
                id: true,
                code: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser?.id,
        username: updatedUser?.username,
        role: updatedUser?.role,
        assignedStores: updatedUser?.storeUsers.map(su => su.store) || [],
      },
    });
  } catch (err: any) {
    console.error('Assign store error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

// DELETE endpoint to unassign a user from a store
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require SUPER_ADMIN role
    const roleCheck = requireRole(Role.SUPER_ADMIN);
    const response = await roleCheck(req);
    
    if (response) {
      return response;
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const body = await req.json();
    const { storeId } = body;

    const storeIdInt = parseInt(storeId, 10);
    if (!storeId || isNaN(storeIdInt)) {
      return NextResponse.json({ error: 'Invalid store id' }, { status: 400 });
    }

    // Delete the StoreUser assignment
    await prisma.storeUser.delete({
      where: {
        userId_storeId: {
          userId: userId,
          storeId: storeIdInt,
        },
      },
    });

    // Return updated user with assigned stores
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        storeUsers: {
          select: {
            store: {
              select: {
                id: true,
                code: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser?.id,
        username: updatedUser?.username,
        role: updatedUser?.role,
        assignedStores: updatedUser?.storeUsers.map(su => su.store) || [],
      },
    });
  } catch (err: any) {
    console.error('Unassign store error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
