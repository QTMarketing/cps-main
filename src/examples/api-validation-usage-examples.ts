/**
 * API Validation Middleware Usage Examples
 * 
 * This file demonstrates how to use the comprehensive API validation
 * middleware in various API routes for the QT Office Check Printing System.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  validateBody, 
  validateQuery, 
  validateFileUpload, 
  validateRequest,
  rateLimit,
  cors,
  securityHeaders,
  createValidationErrorResponse,
  logSecurityEvent,
  type ValidationResult,
  type FileValidationOptions,
} from '@/lib/api-validation';
import { 
  CheckSchema, 
  VendorSchema, 
  BankSchema, 
  UserSchema, 
  LoginSchema,
  ReportFilterSchema,
  type CheckFormData,
  type VendorFormData,
  type BankFormData,
  type UserFormData,
  type LoginData,
  type ReportFilterData,
} from '@/lib/validations';

// =============================================================================
// BASIC API ROUTE EXAMPLES
// =============================================================================

/**
 * Example: Check Creation API with Body Validation
 */
export async function POST_Check(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    const rateLimitCheck = rateLimit(50, 15 * 60 * 1000)(req); // 50 requests per 15 minutes
    if (rateLimitCheck) return rateLimitCheck;

    // Validate request body
    const validation = await validateBody(CheckSchema, {
      sanitize: true,
      preventXSS: true,
      logValidationErrors: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const checkData = validation.data!;

    // Log successful validation
    console.log('Check creation request validated:', {
      checkNumber: checkData.checkNumber,
      amount: checkData.amount,
      payeeName: checkData.payeeName,
    });

    // Proceed with business logic
    const newCheck = await prisma.check.create({
      data: checkData,
    });

    return NextResponse.json(newCheck, { status: 201 });

  } catch (error) {
    console.error('Error creating check:', error);
    return NextResponse.json(
      { error: 'Failed to create check' },
      { status: 500 }
    );
  }
}

/**
 * Example: Vendor Creation API with Body Validation
 */
export async function POST_Vendor(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Validate request body
    const validation = await validateBody(VendorSchema, {
      sanitize: true,
      preventXSS: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const vendorData = validation.data!;

    // Additional business logic validation
    if (vendorData.contact.email && vendorData.contact.phone) {
      // Check if vendor with same email or phone already exists
      const existingVendor = await prisma.vendor.findFirst({
        where: {
          OR: [
            { contact: { path: ['email'], equals: vendorData.contact.email } },
            { contact: { path: ['phone'], equals: vendorData.contact.phone } },
          ],
        },
      });

      if (existingVendor) {
        return NextResponse.json(
          {
            error: 'Vendor already exists',
            message: 'A vendor with this email or phone number already exists',
          },
          { status: 409 }
        );
      }
    }

    // Create vendor
    const newVendor = await prisma.vendor.create({
      data: vendorData,
    });

    return NextResponse.json(newVendor, { status: 201 });

  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}

/**
 * Example: Bank Creation API with Body Validation
 */
export async function POST_Bank(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Validate request body
    const validation = await validateBody(BankSchema, {
      sanitize: true,
      preventXSS: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const bankData = validation.data!;

    // Additional validation for routing number
    if (!isValidRoutingNumber(bankData.routingNumber)) {
      return NextResponse.json(
        {
          error: 'Invalid routing number',
          message: 'The routing number provided is not valid',
        },
        { status: 400 }
      );
    }

    // Check if bank account already exists
    const existingBank = await prisma.bank.findFirst({
      where: {
        accountNumber: bankData.accountNumber,
        routingNumber: bankData.routingNumber,
      },
    });

    if (existingBank) {
      return NextResponse.json(
        {
          error: 'Bank account already exists',
          message: 'A bank account with this account and routing number already exists',
        },
        { status: 409 }
      );
    }

    // Create bank
    const newBank = await prisma.bank.create({
      data: bankData,
    });

    return NextResponse.json(newBank, { status: 201 });

  } catch (error) {
    console.error('Error creating bank:', error);
    return NextResponse.json(
      { error: 'Failed to create bank' },
      { status: 500 }
    );
  }
}

// =============================================================================
// QUERY PARAMETER VALIDATION EXAMPLES
// =============================================================================

/**
 * Example: Reports API with Query Parameter Validation
 */
export async function GET_Reports(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Validate query parameters
    const validation = await validateQuery(ReportFilterSchema, {
      sanitize: true,
      preventXSS: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const filterData = validation.data!;

    // Build database query based on filters
    const where: any = {};

    if (filterData.startDate) {
      where.createdAt = { gte: filterData.startDate };
    }

    if (filterData.endDate) {
      where.createdAt = { ...where.createdAt, lte: filterData.endDate };
    }

    if (filterData.status) {
      where.status = filterData.status;
    }

    if (filterData.paymentMethod) {
      where.paymentMethod = filterData.paymentMethod;
    }

    if (filterData.vendorId) {
      where.vendorId = filterData.vendorId;
    }

    if (filterData.bankId) {
      where.bankId = filterData.bankId;
    }

    if (filterData.userId) {
      where.issuedBy = filterData.userId;
    }

    // Fetch reports
    const reports = await prisma.check.findMany({
      where,
      include: {
        vendor: { select: { vendorName: true } },
        bank: { select: { bankName: true } },
        issuedByUser: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reports });

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

/**
 * Example: User List API with Pagination and Search
 */
export async function GET_Users(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Define query schema for pagination and search
    const querySchema = z.object({
      page: z.string().optional().transform(val => val ? parseInt(val) : 1),
      limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
      search: z.string().optional(),
      role: z.enum(['ADMIN', 'MANAGER', 'USER']).optional(),
      sortBy: z.enum(['username', 'email', 'createdAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    });

    // Validate query parameters
    const validation = await validateQuery(querySchema, {
      sanitize: true,
      preventXSS: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const { page, limit, search, role, sortBy, sortOrder } = validation.data!;

    // Build database query
    const where: any = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const skip = (page - 1) * limit;
    const orderBy = sortBy ? { [sortBy]: sortOrder || 'asc' } : { createdAt: 'desc' };

    // Fetch users
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
// FILE UPLOAD VALIDATION EXAMPLES
// =============================================================================

/**
 * Example: File Upload API with Security Validation
 */
export async function POST_FileUpload(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Define file validation options
    const fileOptions: FileValidationOptions = {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      scanForMalware: true,
    };

    // Validate file uploads
    const validation = await validateFileUpload(fileOptions)(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const files = validation.files;

    // Process each file
    const uploadedFiles = [];
    for (const file of files) {
      // Generate unique filename
      const fileExtension = file.name.split('.').pop();
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

      // Save file to storage (example with local storage)
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = `./uploads/${uniqueFilename}`;
      
      // In production, you would save to cloud storage
      // await fs.writeFile(filePath, buffer);

      // Save file metadata to database
      const fileRecord = await prisma.file.create({
        data: {
          fileName: uniqueFilename,
          originalName: file.name,
          fileSize: file.size,
          fileType: file.type,
          filePath: filePath,
        },
      });

      uploadedFiles.push(fileRecord);
    }

    return NextResponse.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    }, { status: 201 });

  } catch (error) {
    console.error('Error uploading files:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}

// =============================================================================
// COMBINED VALIDATION EXAMPLES
// =============================================================================

/**
 * Example: Combined Body and Query Validation
 */
export async function PUT_Check(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Define query schema for check ID
    const querySchema = z.object({
      id: z.string().uuid('Invalid check ID'),
    });

    // Validate both body and query parameters
    const validation = await validateRequest(
      CheckSchema.partial(), // Allow partial updates
      querySchema,
      {
        sanitize: true,
        preventXSS: true,
        logValidationErrors: true,
      }
    )(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const { body: updateData, query } = validation;

    // Check if check exists
    const existingCheck = await prisma.check.findUnique({
      where: { id: query!.id },
    });

    if (!existingCheck) {
      return NextResponse.json(
        { error: 'Check not found' },
        { status: 404 }
      );
    }

    // Update check
    const updatedCheck = await prisma.check.update({
      where: { id: query!.id },
      data: updateData,
    });

    return NextResponse.json(updatedCheck);

  } catch (error) {
    console.error('Error updating check:', error);
    return NextResponse.json(
      { error: 'Failed to update check' },
      { status: 500 }
    );
  }
}

// =============================================================================
// AUTHENTICATION VALIDATION EXAMPLES
// =============================================================================

/**
 * Example: Login API with Security Validation
 */
export async function POST_Login(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Apply stricter rate limiting for login attempts
    const rateLimitCheck = rateLimit(5, 15 * 60 * 1000)(req); // 5 attempts per 15 minutes
    if (rateLimitCheck) return rateLimitCheck;

    // Validate login data
    const validation = await validateBody(LoginSchema, {
      sanitize: true,
      preventXSS: true,
      logValidationErrors: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const { email, password } = validation.data!;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Log failed login attempt
      logSecurityEvent('FAILED_LOGIN', req, { email, reason: 'User not found' });
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      // Log failed login attempt
      logSecurityEvent('FAILED_LOGIN', req, { email, reason: 'Invalid password' });
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Log successful login
    logSecurityEvent('SUCCESSFUL_LOGIN', req, { userId: user.id, email });

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
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// ERROR HANDLING EXAMPLES
// =============================================================================

/**
 * Example: Custom Error Handling with Validation
 */
export async function POST_CustomValidation(req: NextRequest) {
  try {
    // Apply security middleware
    const securityCheck = securityHeaders()(req);
    if (securityCheck) return securityCheck;

    // Validate request body
    const validation = await validateBody(CheckSchema, {
      sanitize: true,
      preventXSS: true,
    })(req);

    if (validation instanceof NextResponse) {
      return validation;
    }

    const checkData = validation.data!;

    // Custom business logic validation
    if (checkData.amount > 50000) {
      // Log large transaction
      logSecurityEvent('LARGE_TRANSACTION', req, {
        amount: checkData.amount,
        payeeName: checkData.payeeName,
      });

      // Require additional approval for large amounts
      return NextResponse.json(
        {
          error: 'Large transaction requires approval',
          message: 'Transactions over $50,000 require manager approval',
          requiresApproval: true,
        },
        { status: 422 }
      );
    }

    // Proceed with normal processing
    const newCheck = await prisma.check.create({
      data: checkData,
    });

    return NextResponse.json(newCheck, { status: 201 });

  } catch (error) {
    console.error('Error in custom validation:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate routing number using checksum algorithm
 */
function isValidRoutingNumber(routingNumber: string): boolean {
  if (routingNumber.length !== 9) return false;
  
  const digits = routingNumber.split('').map(Number);
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  ) % 10;
  
  return checksum === 0;
}

/**
 * Create a standardized API response
 */
export function createAPIResponse<T>(
  data: T,
  message: string = 'Success',
  status: number = 200
): NextResponse {
  return NextResponse.json({
    success: true,
    message,
    data,
  }, { status });
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: string,
  message: string,
  status: number = 400,
  details?: any
): NextResponse {
  return NextResponse.json({
    success: false,
    error,
    message,
    details,
  }, { status });
}


