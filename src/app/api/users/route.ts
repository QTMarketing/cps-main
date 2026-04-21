/**
 * User Management API Routes
 * 
 * This file provides comprehensive user management functionality for admins
 * to modify user details including ID, username, email, and password.
 * All routes are protected with RBAC middleware.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  requirePermission, 
  requireRole,
  requireMinimumRole,
  Permission, 
  Role,
  getUserFromRequest 
} from '@/lib/rbac';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const RoleEnum = z.enum([
  'USER',
  'STORE_USER',
  'BACK_OFFICE',
  'ADMIN',
  'OFFICE_ADMIN',
  'SUPER_ADMIN',
]);

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(8).optional(),
  assignedBankId: z.number().int().optional(),
  role: RoleEnum.optional(),
});

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  assignedBankId: z.number().int().optional(),
  storeId: z.number().int().optional(), // Direct store assignment
  role: RoleEnum.default('USER'),
});

// =============================================================================
// GET /api/users - List all users (Admin only)
// =============================================================================

export async function GET(req: NextRequest) {
  // Require ADMIN role or higher to view all users
  const roleCheck = requireMinimumRole(Role.ADMIN);
  const response = await roleCheck(req);
  
  if (response) {
    return response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: any = {};
    
    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          role: true,
          assigned_bank_id: true,
          store_id: true,
          max_cheque_amount_cents: true,
          Store: {
            select: {
              id: true,
              name: true,
            },
          },
          created_at: true,
        },
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Format response to match frontend expectations
    const formattedUsers = users.map((user) => ({
      id: String(user.id),
      username: user.username,
      email: `${user.username}@system.local`, // Placeholder since User model has no email
      role: user.role,
      storeId: user.store_id ? String(user.store_id) : "",
      storeName: user.Store?.name || null,
      maxChequeAmountCents: user.max_cheque_amount_cents,
      store: user.Store ? {
        name: user.Store.name,
      } : undefined,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.created_at.toISOString(), // Fallback to created_at
    }));

    console.log('[GET /api/users] Returning users:', {
      count: formattedUsers.length,
      total,
      firstUser: formattedUsers[0] ? {
        id: formattedUsers[0].id,
        username: formattedUsers[0].username,
        role: formattedUsers[0].role,
      } : null,
    });

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/users - Create new user (Admin only)
// =============================================================================

export async function POST(req: NextRequest) {
  // Require SUPER_ADMIN role to create users
  const roleCheck = requireRole(Role.SUPER_ADMIN);
  const response = await roleCheck(req);
  
  // Debug logging
  if (response) {
    const errorBody = await response.clone().json().catch(() => ({}));
    console.log('[POST /api/users] RBAC check failed:', {
      status: response.status,
      error: errorBody,
    });
  } else {
    console.log('[POST /api/users] RBAC check passed');
  }
  
  if (response) {
    return response;
  }

  try {
    const body = await req.json();
    const validatedData = createUserSchema.parse(body);
    const requestedRole = validatedData.role || 'USER';

    // Check if username already exists
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username: validatedData.username },
    });

    if (existingUserByUsername) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Validate storeId if provided
    if (validatedData.storeId) {
      const storeExists = await prisma.store.findUnique({
        where: { id: validatedData.storeId },
      });
      
      if (!storeExists) {
        return NextResponse.json(
          { error: 'Invalid storeId: Store not found' },
          { status: 400 }
        );
      }
    }

    // Enforce store assignment for store-scoped roles only
    const STORE_REQUIRED_ROLES = new Set(['USER', 'STORE_USER']);
    if (STORE_REQUIRED_ROLES.has(requestedRole)) {
      if (!validatedData.storeId) {
        return NextResponse.json(
          {
            error: 'Store assignment required',
            message: `Users with role ${requestedRole} must be assigned to a store. Please select a store.`,
            field: 'storeId',
          },
          { status: 400 }
        );
      }
    }

    // Create user (simple, with direct storeId)
    const user = await prisma.user.create({
      data: {
        username: validatedData.username,
        password_hash: hashedPassword,
        assigned_bank_id: validatedData.assignedBankId || null,
        store_id: validatedData.storeId || null,
        role: requestedRole as Role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        assigned_bank_id: true,
        store_id: true,
        created_at: true,
      },
    });

    // Format minimal response
    const formattedUser = {
      id: String(user.id),
      username: user.username,
      email: `${user.username}@system.local`,
      role: user.role,
      storeId: user.store_id,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.created_at.toISOString(),
    };

    console.log('[POST /api/users] Created user:', formattedUser);

    return NextResponse.json(formattedUser, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}


