/**
 * User Checks API Routes
 * 
 * This file handles operations related to user checks.
 * All routes are protected with RBAC middleware requiring ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Role } from '@/lib/rbac';

// =============================================================================
// GET /api/users/[id]/checks - Get user's checks (Admin only)
// =============================================================================

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Require ADMIN role to view user checks
  const roleCheck = requireRole(Role.ADMIN);
  const response = await roleCheck(req);
  
  if (response) {
    return response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Check if user exists
    const { id } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const [checks, total] = await Promise.all([
      prisma.check.findMany({
        where: { issuedBy: id },
        include: {
          vendor: {
            select: {
              vendorName: true,
              vendorType: true,
            },
          },
          bank: {
            select: {
              bankName: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.check.count({
        where: { issuedBy: id },
      }),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
      },
      checks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching user checks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user checks' },
      { status: 500 }
    );
  }
}
