/**
 * Protected API Routes Examples - Vendors Management
 * 
 * This file demonstrates how to implement RBAC-protected API routes
 * for vendor management operations using the RBAC middleware system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, Permission } from '@/lib/rbac';
import { z } from 'zod';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface CreateVendorRequest {
  vendorName: string;
  vendorType: 'MERCHANDISE' | 'EXPENSE' | 'EMPLOYEE';
  description?: string;
  contact: {
    email?: string;
    phone?: string;
    address?: string;
  };
  storeId: string;
}

interface VendorResponse {
  id: string;
  vendorName: string;
  vendorType: string;
  description?: string;
  contact: any;
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

const createVendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  vendorType: z.enum(['MERCHANDISE', 'EXPENSE', 'EMPLOYEE'], {
    message: 'Invalid vendor type',
  }),
  description: z.string().optional(),
  contact: z.object({
    email: z.string().email('Invalid email').optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  storeId: z.string().min(1, 'Store ID is required'),
});

const updateVendorSchema = createVendorSchema.partial();

// =============================================================================
// POST /api/vendors - Create New Vendor (MANAGE_VENDORS permission required)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Check MANAGE_VENDORS permission
    const permissionCheck = requirePermission(Permission.MANAGE_VENDORS);
    const response = await permissionCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized vendor creation attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    // Parse and validate request body
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

    // Check if vendor name already exists for this store
    const existingVendor = await prisma.vendor.findFirst({
      where: {
        vendorName: validatedData.vendorName,
        storeId: validatedData.storeId,
      },
    });

    if (existingVendor) {
      return NextResponse.json(
        { error: 'Vendor with this name already exists in this store' },
        { status: 400 }
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

    // Log successful vendor creation
    console.log(`Vendor ${newVendor.vendorName} created successfully`);

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

// =============================================================================
// GET /api/vendors - List Vendors (VIEW_VENDORS permission required)
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Check VIEW_VENDORS permission
    const permissionCheck = requirePermission(Permission.VIEW_VENDORS);
    const response = await permissionCheck(req);

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const vendorType = searchParams.get('vendorType') || '';
    const storeId = searchParams.get('storeId') || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.vendorName = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    if (vendorType) {
      where.vendorType = vendorType;
    }
    
    if (storeId) {
      where.storeId = storeId;
    }

    const vendors = await prisma.vendor.findMany({
      skip,
      take: limit,
      where,
      include: {
        store: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalVendors = await prisma.vendor.count({ where });

    return NextResponse.json({
      data: vendors,
      total: totalVendors,
      page,
      limit,
      totalPages: Math.ceil(totalVendors / limit),
    });

  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/vendors/[id] - Update Vendor (MANAGE_VENDORS permission required)
// =============================================================================

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check MANAGE_VENDORS permission
    const permissionCheck = requirePermission(Permission.MANAGE_VENDORS);
    const response = await permissionCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized vendor update attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const vendorId = (await params).id;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateVendorSchema.parse(body);

    // Check if vendor exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!existingVendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Check for name conflicts if vendor name is being updated
    if (validatedData.vendorName && validatedData.vendorName !== existingVendor.vendorName) {
      const nameExists = await prisma.vendor.findFirst({
        where: {
          vendorName: validatedData.vendorName,
          storeId: validatedData.storeId || existingVendor.storeId,
          id: { not: vendorId },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'Vendor with this name already exists in this store' },
          { status: 400 }
        );
      }
    }

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

    // Log successful vendor update
    console.log(`Vendor ${updatedVendor.vendorName} updated successfully`);

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
// DELETE /api/vendors/[id] - Delete Vendor (MANAGE_VENDORS permission required)
// =============================================================================

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check MANAGE_VENDORS permission
    const permissionCheck = requirePermission(Permission.MANAGE_VENDORS);
    const response = await permissionCheck(req);

    if (response) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized vendor deletion attempt from IP: ${req.ip || 'unknown'}`);
      return response;
    }

    const vendorId = (await params).id;

    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Check for associated checks
    const associatedChecks = await prisma.check.count({
      where: { vendorId },
    });

    if (associatedChecks > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete vendor with associated checks',
          details: `This vendor has ${associatedChecks} associated check(s)`
        },
        { status: 400 }
      );
    }

    // Delete the vendor
    await prisma.vendor.delete({
      where: { id: vendorId },
    });

    // Log successful vendor deletion
    console.log(`Vendor ${vendor.vendorName} deleted successfully`);

    return NextResponse.json(
      { message: 'Vendor deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor' },
      { status: 500 }
    );
  }
}





