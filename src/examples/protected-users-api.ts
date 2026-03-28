/**
 * Protected API Routes Examples - Users Management
 * 
 * This file demonstrates how to implement RBAC-protected API routes
 * for user management operations using the RBAC middleware system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireRole, Permission, Role } from '@/lib/rbac';
import { hash, compare } from 'bcryptjs';
import { z } from 'zod';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: Role;
  storeId: string;
}

interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: Role;
  storeId?: string;
}

interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  storeId: string;
  createdAt: string;
  updatedAt: string;
  store: {
    name: string;
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([Role.ADMIN, Role.MANAGER, Role.USER], {
    message: 'Invalid role',
  }),
  storeId: z.string().min(1, 'Store ID is required'),
});

const updateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum([Role.ADMIN, Role.MANAGER, Role.USER], {
    message: 'Invalid role',
  }).optional(),
  storeId: z.string().min(1, 'Store ID is required').optional(),
}).refine(data => data.username || data.email || data.role || data.storeId, {
  message: "At least one field must be provided for update",
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// =============================================================================
// POST /api/users - Create New User (MANAGE_USERS permission, ADMIN only)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Require ADMIN role for creating users
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized user creation attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createUserSchema.parse(body);

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: validatedData.storeId },
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: validatedData.username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await hash(validatedData.password, 12);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        username: validatedData.username,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        storeId: validatedData.storeId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: { name: true },
        },
      },
    });

    // Log successful user creation
    console.log(`User ${newUser.username} created successfully with role ${newUser.role}`);

    return NextResponse.json(newUser, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/users - List Users (VIEW_USERS permission required)
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Check VIEW_USERS permission
    const permissionCheck = requirePermission(Permission.VIEW_USERS);
    const response = await permissionCheck(req);

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || '';
    const storeId = searchParams.get('storeId') || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (roleFilter) {
      where.role = roleFilter;
    }
    
    if (storeId) {
      where.storeId = storeId;
    }

    const users = await prisma.user.findMany({
      skip,
      take: limit,
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalUsers = await prisma.user.count({ where });

    return NextResponse.json({
      data: users,
      total: totalUsers,
      page,
      limit,
      totalPages: Math.ceil(totalUsers / limit),
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/users/[id] - Update User (MANAGE_USERS permission, ADMIN only)
// =============================================================================

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role for updating users
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized user update attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const userId = (await params).id;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateUserSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check for username conflicts
    if (validatedData.username && validatedData.username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: validatedData.username },
      });

      if (usernameExists) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        );
      }
    }

    // Check for email conflicts
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: { name: true },
        },
      },
    });

    // Log successful user update
    console.log(`User ${updatedUser.username} updated successfully`);

    return NextResponse.json(updatedUser);

  } catch (error) {
    console.error('Error updating user:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/users/[id] - Delete User (MANAGE_USERS permission, ADMIN only)
// =============================================================================

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role for deleting users
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized user deletion attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const userId = (await params).id;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of the last admin
    if (user.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin user' },
          { status: 400 }
        );
      }
    }

    // Check for associated checks
    const associatedChecks = await prisma.check.count({
      where: { issuedBy: userId },
    });

    if (associatedChecks > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete user with associated checks',
          details: `This user has ${associatedChecks} associated check(s)`
        },
        { status: 400 }
      );
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    // Log successful user deletion
    console.log(`User ${user.username} deleted successfully`);

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/users/[id]/password - Change User Password (MANAGE_USERS permission, ADMIN only)
// =============================================================================

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role for changing user passwords
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized password change attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const userId = (await params).id;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = changePasswordSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(validatedData.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedNewPassword = await hash(validatedData.newPassword, 12);

    // Update the password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Log successful password change
    console.log(`Password changed successfully for user ${user.username}`);

    return NextResponse.json(
      { message: 'Password changed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error changing password:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}





