/**
 * Example: Bank, Vendor, and User Operations with Comprehensive Audit Logging
 * 
 * This example shows how to integrate audit logging into bank, vendor, and user
 * operations with complete before/after state tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireRole, Permission, Role } from '@/lib/rbac';
import { requireReAuth } from '@/lib/reauth';
import { 
  logBankOperation,
  logVendorOperation,
  logUserOperation,
  logAuthEvent,
  AuditAction, 
  EntityType 
} from '@/lib/audit-log';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createBankSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  routingNumber: z.string().min(9, 'Routing number must be at least 9 digits'),
  storeId: z.string().min(1, 'Store ID is required'),
  balance: z.number().min(0, 'Balance cannot be negative'),
});

const createVendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  vendorType: z.enum(['MERCHANDISE', 'EXPENSE', 'EMPLOYEE']),
  description: z.string().optional(),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  storeId: z.string().min(1, 'Store ID is required'),
});

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([Role.ADMIN, Role.MANAGER, Role.USER]),
  storeId: z.string().min(1, 'Store ID is required'),
});

// =============================================================================
// BANK OPERATIONS WITH AUDIT LOGGING
// =============================================================================

export async function POST_Bank(req: NextRequest) {
  try {
    // Require ADMIN role for creating banks
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);
    if (response) {
      return response;
    }

    // Require re-authentication for bank operations
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
    }

    const body = await req.json();
    const validatedData = createBankSchema.parse(body);

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

    // Create the bank
    const newBank = await prisma.bank.create({
      data: {
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        routingNumber: validatedData.routingNumber,
        storeId: validatedData.storeId,
        balance: validatedData.balance,
      },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log audit event
    await logBankOperation(
      req,
      'admin-user-id', // This would come from JWT token
      AuditAction.CREATE_BANK,
      newBank.id,
      undefined, // No old values for creation
      {
        bankName: newBank.bankName,
        accountNumber: newBank.accountNumber,
        routingNumber: newBank.routingNumber,
        balance: newBank.balance,
        store: newBank.store.name,
      }
    );

    return NextResponse.json(newBank, { status: 201 });

  } catch (error) {
    console.error('Error creating bank:', error);

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
      { error: 'Failed to create bank' },
      { status: 500 }
    );
  }
}

export async function PATCH_BankBalance(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);
    if (response) {
      return response;
    }

    // Require re-authentication for balance changes
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
    }

    const bankId = (await params).id;

    // Get current bank state for audit
    const currentBank = await prisma.bank.findUnique({
      where: { id: bankId },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    if (!currentBank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { balance, reason } = z.object({
      balance: z.number().min(0, 'Balance cannot be negative'),
      reason: z.string().min(1, 'Reason is required for balance updates'),
    }).parse(body);

    // Update bank balance
    const updatedBank = await prisma.bank.update({
      where: { id: bankId },
      data: { balance },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log audit event with balance change
    await logBankOperation(
      req,
      'admin-user-id', // This would come from JWT token
      AuditAction.UPDATE_BALANCE,
      bankId,
      {
        bankName: currentBank.bankName,
        accountNumber: currentBank.accountNumber,
        routingNumber: currentBank.routingNumber,
        balance: currentBank.balance,
        store: currentBank.store.name,
      },
      {
        bankName: updatedBank.bankName,
        accountNumber: updatedBank.accountNumber,
        routingNumber: updatedBank.routingNumber,
        balance: updatedBank.balance,
        store: updatedBank.store.name,
        reason,
      }
    );

    return NextResponse.json({
      ...updatedBank,
      oldBalance: currentBank.balance,
      reason,
    });

  } catch (error) {
    console.error('Error updating bank balance:', error);

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
      { error: 'Failed to update bank balance' },
      { status: 500 }
    );
  }
}

// =============================================================================
// VENDOR OPERATIONS WITH AUDIT LOGGING
// =============================================================================

export async function POST_Vendor(req: NextRequest) {
  try {
    // Check permissions
    const permissionCheck = requirePermission(Permission.MANAGE_VENDORS);
    const response = await permissionCheck(req);
    if (response) {
      return response;
    }

    const body = await req.json();
    const validatedData = createVendorSchema.parse(body);

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

    // Create the vendor
    const newVendor = await prisma.vendor.create({
      data: {
        vendorName: validatedData.vendorName,
        vendorType: validatedData.vendorType,
        description: validatedData.description,
        contact: validatedData.contact,
        storeId: validatedData.storeId,
      },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log audit event
    await logVendorOperation(
      req,
      'user-id', // This would come from JWT token
      AuditAction.CREATE_VENDOR,
      newVendor.id,
      undefined, // No old values for creation
      {
        vendorName: newVendor.vendorName,
        vendorType: newVendor.vendorType,
        description: newVendor.description,
        contact: newVendor.contact,
        store: newVendor.store.name,
      }
    );

    return NextResponse.json(newVendor, { status: 201 });

  } catch (error) {
    console.error('Error creating vendor:', error);

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
      { error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}

export async function PUT_Vendor(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permissions
    const permissionCheck = requirePermission(Permission.MANAGE_VENDORS);
    const response = await permissionCheck(req);
    if (response) {
      return response;
    }

    const vendorId = (await params).id;

    // Get current vendor state for audit
    const currentVendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    if (!currentVendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validatedData = createVendorSchema.partial().parse(body);

    // Update the vendor
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: validatedData,
      include: {
        store: {
          select: { name: true },
        },
      },
    });

    // Log audit event
    await logVendorOperation(
      req,
      'user-id', // This would come from JWT token
      AuditAction.UPDATE_VENDOR,
      vendorId,
      {
        vendorName: currentVendor.vendorName,
        vendorType: currentVendor.vendorType,
        description: currentVendor.description,
        contact: currentVendor.contact,
        store: currentVendor.store.name,
      },
      {
        vendorName: updatedVendor.vendorName,
        vendorType: updatedVendor.vendorType,
        description: updatedVendor.description,
        contact: updatedVendor.contact,
        store: updatedVendor.store.name,
      }
    );

    return NextResponse.json(updatedVendor);

  } catch (error) {
    console.error('Error updating vendor:', error);

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
      { error: 'Failed to update vendor' },
      { status: 500 }
    );
  }
}

// =============================================================================
// USER OPERATIONS WITH AUDIT LOGGING
// =============================================================================

export async function POST_User(req: NextRequest) {
  try {
    // Require ADMIN role for creating users
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);
    if (response) {
      return response;
    }

    // Require re-authentication for user management
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
    }

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

    // Log audit event
    await logUserOperation(
      req,
      'admin-user-id', // This would come from JWT token
      AuditAction.CREATE_USER,
      newUser.id,
      undefined, // No old values for creation
      {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        store: newUser.store.name,
      }
    );

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

export async function PATCH_UserPassword(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN role
    const roleCheck = requireRole(Role.ADMIN);
    const response = await roleCheck(req);
    if (response) {
      return response;
    }

    // Require re-authentication for password changes
    const reAuthCheck = requireReAuth();
    const reAuthResponse = await reAuthCheck(req);
    if (reAuthResponse) {
      return reAuthResponse;
    }

    const userId = (await params).id;

    // Get current user state for audit
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        store: {
          select: { name: true },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { newPassword, reason } = z.object({
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
      reason: z.string().min(1, 'Reason is required for password changes'),
    }).parse(body);

    // Hash the new password
    const hashedPassword = await hash(newPassword, 12);

    // Update the password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Log audit event
    await logUserOperation(
      req,
      'admin-user-id', // This would come from JWT token
      AuditAction.CHANGE_PASSWORD,
      userId,
      {
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role,
        store: currentUser.store.name,
      },
      {
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role,
        store: currentUser.store.name,
        passwordChanged: true,
        reason,
      }
    );

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

// =============================================================================
// AUTHENTICATION OPERATIONS WITH AUDIT LOGGING
// =============================================================================

export async function POST_Login(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      // Log failed login attempt
      await logAuthEvent(
        req,
        'unknown',
        AuditAction.FAILED_LOGIN,
        false,
        { email, reason: 'User not found' }
      );

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Log failed login attempt
      await logAuthEvent(
        req,
        user.id,
        AuditAction.FAILED_LOGIN,
        false,
        { email, reason: 'Invalid password' }
      );

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Log successful login
    await logAuthEvent(
      req,
      user.id,
      AuditAction.LOGIN,
      true,
      { email, role: user.role }
    );

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Error during login:', error);

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
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}

export async function POST_Logout(req: NextRequest) {
  try {
    // Extract user ID from JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Log logout event
    await logAuthEvent(
      req,
      decodedToken.userId,
      AuditAction.LOGOUT,
      true,
      { username: decodedToken.username }
    );

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}


