/**
 * User Role Update API Route
 * 
 * This endpoint allows SUPER_ADMIN users to update a user's role.
 * When a role is changed, the user's token is revoked by setting token_revoked_at.
 * This forces the user to log in again with their new role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Role } from '@/lib/rbac';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const updateRoleSchema = z.object({
  role: z.enum(['USER', 'STORE_USER', 'BACK_OFFICE', 'ADMIN', 'OFFICE_ADMIN', 'SUPER_ADMIN']),
});

// =============================================================================
// PUT /api/users/[id]/role - Update user role (SUPER_ADMIN only)
// =============================================================================

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Require SUPER_ADMIN role to change user roles
  const roleCheck = requireRole(Role.SUPER_ADMIN);
  const response = await roleCheck(req);

  if (response) {
    return response;
  }

  try {
    const { id } = await context.params;
    const userIdParam = id;
    const body = await req.json();
    const validatedData = updateRoleSchema.parse(body);
    const newRole = validatedData.role as Role;

    // Parse user ID (handle both string and number)
    const userId = typeof userIdParam === 'string' 
      ? parseInt(userIdParam, 10) 
      : userIdParam;

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        token_revoked_at: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if role is actually changing
    if (existingUser.role === newRole) {
      return NextResponse.json(
        { 
          message: 'Role unchanged',
          user: {
            id: existingUser.id,
            username: existingUser.username,
            role: existingUser.role,
          }
        },
        { status: 200 }
      );
    }

    // Update user role and revoke token
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        token_revoked_at: new Date(), // Revoke token to force re-login
      },
      select: {
        id: true,
        username: true,
        role: true,
        token_revoked_at: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      message: 'Role updated successfully. User must log in again.',
      user: updatedUser,
      previousRole: existingUser.role,
      newRole: updatedUser.role,
      tokenRevoked: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating user role:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update user role',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

