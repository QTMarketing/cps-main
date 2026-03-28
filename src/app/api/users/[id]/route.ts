/**
 * Individual User API Routes
 * 
 * This file handles operations on specific users by ID.
 * All routes are protected with RBAC middleware requiring ADMIN role or higher.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMinimumRole, Role } from '@/lib/rbac';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
  storeId: z.union([z.string(), z.number()]).transform(val => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (!Number.isFinite(num)) throw new Error('Invalid storeId');
    return num;
  }).optional(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(8),
});

// =============================================================================
// GET /api/users/[id] - Get specific user details
// =============================================================================

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const roleCheck = requireMinimumRole(Role.ADMIN);
  const response = await roleCheck(req);
  
  if (response) {
    return response;
  }

  try {
    const { id: idParam } = await context.params;
    const id = Number.parseInt(idParam, 10);
    
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid user id' },
        { status: 400 }
      );
    }
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        created_at: true,
        assigned_bank_id: true,
        Bank_Bank_assigned_to_user_idToUser: {
          select: {
            id: true,
            dba: true,
            bank_name: true,
            account_type: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Format response with assignedBanks alias for frontend compatibility
    return NextResponse.json({ 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
        assignedBanks: user.Bank_Bank_assigned_to_user_idToUser,
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/users/[id] - Update user details
// =============================================================================

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const roleCheck = requireMinimumRole(Role.ADMIN);
  const response = await roleCheck(req);
  
  if (response) {
    return response;
  }

  try {
    const body = await req.json();
    console.log('[PUT /api/users/[id]] Request body:', JSON.stringify(body, null, 2));
    
    let validatedData;
    try {
      validatedData = updateUserSchema.parse(body);
      console.log('[PUT /api/users/[id]] Validated data:', JSON.stringify(validatedData, null, 2));
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error('[PUT /api/users/[id]] Validation failed:', JSON.stringify(validationError.issues, null, 2));
        return NextResponse.json(
          { 
            error: 'Validation error', 
            details: validationError.issues,
            receivedBody: body 
          },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Check if user exists
    const { id: idParam } = await context.params;
    const id = Number.parseInt(idParam, 10);
    
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid user id' },
        { status: 400 }
      );
    }
    
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check for username conflicts (if username is being updated)
    if (validatedData.username && validatedData.username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: validatedData.username },
      });

      if (usernameExists) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
    }

    // Validate store exists (if storeId is being updated)
    if (validatedData.storeId !== undefined) {
      if (validatedData.storeId !== null) {
        const storeExists = await prisma.store.findUnique({
          where: { id: validatedData.storeId },
        });

        if (!storeExists) {
          console.error('[PUT /api/users/[id]] Store not found:', validatedData.storeId);
          return NextResponse.json(
            { error: 'Store not found', storeId: validatedData.storeId },
            { status: 400 }
          );
        }
        console.log('[PUT /api/users/[id]] Store validated:', storeExists.name);
      }
    }

    // Enforce store assignment rules for non-SUPER_ADMIN users
    if (validatedData.role || validatedData.storeId !== undefined) {
      // Determine the effective role after update
      const effectiveRole = validatedData.role || existingUser.role;
      const effectiveStoreId = validatedData.storeId !== undefined 
        ? validatedData.storeId 
        : existingUser.store_id;
      
      // Non-SUPER_ADMIN users must have a store
      if (effectiveRole !== 'SUPER_ADMIN' && effectiveStoreId === null) {
        return NextResponse.json(
          { 
            error: 'Store assignment required', 
            message: `Users with role ${effectiveRole} must be assigned to a store. Cannot set store_id to null.`,
            field: 'storeId'
          },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (validatedData.username) {
      updateData.username = validatedData.username;
    }
    
    if (validatedData.role) {
      updateData.role = validatedData.role;
    }
    
    if (validatedData.storeId !== undefined) {
      updateData.store_id = validatedData.storeId;
      console.log('[PUT /api/users/[id]] Setting store_id to:', validatedData.storeId);
    }
    
    if (validatedData.password) {
      updateData.password_hash = await bcrypt.hash(validatedData.password, 12);
    }

    console.log('[PUT /api/users/[id]] Update data for Prisma:', JSON.stringify(updateData, null, 2));

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        created_at: true,
        assigned_bank_id: true,
        store_id: true,
        Store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    console.log('[PUT /api/users/[id]] User updated successfully:', updatedUser.id);

    return NextResponse.json({ 
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        createdAt: updatedUser.created_at,
        storeId: updatedUser.store_id,
        store: updatedUser.Store,
      },
      message: 'User updated successfully',
      updatedFields: Object.keys(validatedData),
    });
  } catch (error) {
    console.error('[PUT /api/users/[id]] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to update user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/users/[id] - Delete user
// =============================================================================

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const roleCheck = requireMinimumRole(Role.ADMIN);
  const response = await roleCheck(req);
  
  if (response) {
    return response;
  }

  try {
    // Check if user exists
    const { id: idParam } = await context.params;
    const id = Number.parseInt(idParam, 10);
    
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid user id' },
        { status: 400 }
      );
    }
    
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has any associated checks
    const userChecks = await prisma.check.count({
      where: { issuedBy: id },
    });

    if (userChecks > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete user with associated checks',
          details: `User has ${userChecks} checks associated with their account`,
          suggestion: 'Consider transferring checks to another user or voiding them first'
        },
        { status: 400 }
      );
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id: existingUser.id,
        username: existingUser.username,
        role: existingUser.role,
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}