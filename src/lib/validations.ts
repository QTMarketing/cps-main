/**
 * Comprehensive Zod Validation Schemas
 * 
 * This module provides comprehensive validation schemas for all forms in the
 * QT Office Check Printing System using Zod with custom error messages,
 * sanitization, and business rule validation.
 */

import { z } from 'zod';

// =============================================================================
// COMMON VALIDATION HELPERS
// =============================================================================

/**
 * UUID validation helper
 */
const uuidSchema = z.string().uuid({
  message: 'Must be a valid UUID format',
});

/**
 * Email validation with custom error message
 */
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters')
  .toLowerCase()
  .trim();

/**
 * Phone number validation (US format)
 */
const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(
    /^(\+1\s?)?(\([0-9]{3}\)|[0-9]{3})[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/,
    'Please enter a valid US phone number (e.g., (555) 123-4567 or 555-123-4567)'
  )
  .transform((val) => val.replace(/\D/g, '')) // Remove non-digits for storage
  .pipe(z.string().length(10, 'Phone number must be exactly 10 digits'));

/**
 * Strong password validation
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be less than 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
  );

/**
 * Currency amount validation (max $999,999.99)
 */
const currencySchema = z
  .number({ message: 'Amount must be a number' })
  .positive('Amount must be positive')
  .max(999999.99, 'Amount cannot exceed $999,999.99')
  .refine(
    (val) => {
      // Check for exactly 2 decimal places
      const str = val.toString();
      const parts = str.split('.');
      return parts.length === 1 || (parts.length === 2 && parts[1].length <= 2);
    },
    'Amount can have at most 2 decimal places'
  )
  .transform((val) => Math.round(val * 100) / 100); // Round to 2 decimal places

/**
 * Alphanumeric string validation
 */
const alphanumericSchema = z
  .string()
  .min(1, 'This field is required')
  .regex(
    /^[a-zA-Z0-9]+$/,
    'Only letters and numbers are allowed'
  );

/**
 * Name validation (letters, spaces, hyphens only)
 */
const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(
    /^[a-zA-Z\s\-']+$/,
    'Name can only contain letters, spaces, hyphens, and apostrophes'
  )
  .transform((val) => val.trim());

// =============================================================================
// CHECK VALIDATION SCHEMAS
// =============================================================================

/**
 * Check Number validation
 */
const checkNumberSchema = z
  .string()
  .min(1, 'Check number is required')
  .max(20, 'Check number must be less than 20 characters')
  .regex(
    /^[a-zA-Z0-9\-_]+$/,
    'Check number can only contain letters, numbers, hyphens, and underscores'
  )
  .transform((val) => val.trim().toUpperCase());

/**
 * Payee Name validation
 */
const payeeNameSchema = z
  .string()
  .min(1, 'Payee name is required')
  .max(100, 'Payee name must be less than 100 characters')
  .regex(
    /^[a-zA-Z\s\-'.,&]+$/,
    'Payee name can only contain letters, spaces, hyphens, apostrophes, periods, commas, and ampersands'
  )
  .transform((val) => val.trim());

/**
 * Memo validation
 */
const memoSchema = z
  .string()
  .max(200, 'Memo must be less than 200 characters')
  .optional()
  .transform((val) => val?.trim() || '');

/**
 * Payment Method enum
 */
const paymentMethodSchema = z.enum(['Check', 'EDI', 'MO', 'Cash'], {
  message: 'Invalid payment method',
});

/**
 * Complete Check Schema
 */
export const CheckSchema = z.object({
  checkNumber: checkNumberSchema,
  amount: currencySchema,
  payeeName: payeeNameSchema,
  memo: memoSchema,
  bankId: uuidSchema,
  vendorId: uuidSchema,
  paymentMethod: paymentMethodSchema,
  issuedBy: uuidSchema.optional(), // Will be set from JWT token
}).refine(
  (data) => {
    // Additional business rules can be added here
    return true;
  },
  {
    message: 'Check validation failed',
  }
);

/**
 * Check Update Schema (all fields optional except ID)
 */
export const CheckUpdateSchema = CheckSchema.partial().extend({
  id: uuidSchema,
});

/**
 * Check Void Schema
 */
export const CheckVoidSchema = z.object({
  id: uuidSchema,
  reason: z
    .string()
    .min(1, 'Void reason is required')
    .max(200, 'Void reason must be less than 200 characters')
    .transform((val) => val.trim()),
});

// =============================================================================
// VENDOR VALIDATION SCHEMAS
// =============================================================================

/**
 * Vendor Type enum
 */
const vendorTypeSchema = z.enum(['MERCHANDISE', 'EXPENSE', 'EMPLOYEE'], {
  message: 'Invalid vendor type',
});

/**
 * Vendor Contact Schema
 */
const vendorContactSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .transform((val) => val?.trim() || ''),
}).refine(
  (data) => data.email || data.phone || data.address,
  {
    message: 'At least one contact method (email, phone, or address) is required',
    path: ['email'],
  }
);

/**
 * Complete Vendor Schema
 */
export const VendorSchema = z.object({
  vendorName: nameSchema,
  vendorType: vendorTypeSchema,
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform((val) => val?.trim() || ''),
  contact: vendorContactSchema,
  storeId: uuidSchema,
}).refine(
  (data) => {
    // Additional business rules
    return true;
  },
  {
    message: 'Vendor validation failed',
  }
);

/**
 * Vendor Update Schema
 */
export const VendorUpdateSchema = VendorSchema.partial().extend({
  id: uuidSchema,
});

// =============================================================================
// BANK VALIDATION SCHEMAS
// =============================================================================

/**
 * Bank Name validation
 */
const bankNameSchema = z
  .string()
  .min(1, 'Bank name is required')
  .max(100, 'Bank name must be less than 100 characters')
  .regex(
    /^[a-zA-Z\s\-'.,&()]+$/,
    'Bank name can only contain letters, spaces, hyphens, apostrophes, periods, commas, ampersands, and parentheses'
  )
  .transform((val) => val.trim());

/**
 * Account Number validation
 */
const accountNumberSchema = z
  .string()
  .min(1, 'Account number is required')
  .max(20, 'Account number must be less than 20 characters')
  .regex(
    /^[0-9]+$/,
    'Account number can only contain numbers'
  )
  .transform((val) => val.trim());

/**
 * Routing Number validation (9 digits)
 */
const routingNumberSchema = z
  .string()
  .min(1, 'Routing number is required')
  .length(9, 'Routing number must be exactly 9 digits')
  .regex(
    /^[0-9]{9}$/,
    'Routing number must be exactly 9 digits'
  )
  .transform((val) => val.trim());

/**
 * Bank Balance validation
 */
const bankBalanceSchema = z
  .number({ message: 'Balance must be a number' })
  .min(0, 'Balance cannot be negative')
  .max(999999999.99, 'Balance cannot exceed $999,999,999.99')
  .refine(
    (val) => {
      const str = val.toString();
      const parts = str.split('.');
      return parts.length === 1 || (parts.length === 2 && parts[1].length <= 2);
    },
    'Balance can have at most 2 decimal places'
  )
  .transform((val) => Math.round(val * 100) / 100);

/**
 * Complete Bank Schema
 */
export const BankSchema = z.object({
  bankName: bankNameSchema,
  accountNumber: accountNumberSchema,
  routingNumber: routingNumberSchema,
  storeId: uuidSchema,
  balance: bankBalanceSchema,
}).refine(
  (data) => {
    // Additional business rules
    return true;
  },
  {
    message: 'Bank validation failed',
  }
);

/**
 * Bank Update Schema
 */
export const BankUpdateSchema = BankSchema.partial().extend({
  id: uuidSchema,
});

/**
 * Bank Balance Update Schema
 */
export const BankBalanceUpdateSchema = z.object({
  id: uuidSchema,
  balance: bankBalanceSchema,
  reason: z
    .string()
    .min(1, 'Reason for balance change is required')
    .max(200, 'Reason must be less than 200 characters')
    .transform((val) => val.trim()),
});

// =============================================================================
// USER VALIDATION SCHEMAS
// =============================================================================

/**
 * Username validation
 */
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters long')
  .max(50, 'Username must be less than 50 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  )
  .transform((val) => val.trim().toLowerCase());

/**
 * User Role enum
 */
const userRoleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'USER'], {
  message: 'Invalid user role',
});

/**
 * Complete User Schema
 */
export const UserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: userRoleSchema,
  storeId: uuidSchema,
}).refine(
  (data) => {
    // Additional business rules
    return true;
  },
  {
    message: 'User validation failed',
  }
);

/**
 * User Update Schema (password not required for updates)
 */
export const UserUpdateSchema = UserSchema.omit({ password: true }).partial().extend({
  id: uuidSchema,
});

/**
 * Password Change Schema
 */
export const PasswordChangeSchema = z.object({
  id: uuidSchema,
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

/**
 * Password Reset Schema
 */
export const PasswordResetSchema = z.object({
  id: uuidSchema,
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// =============================================================================
// STORE VALIDATION SCHEMAS
// =============================================================================

/**
 * Store Name validation
 */
const storeNameSchema = z
  .string()
  .min(1, 'Store name is required')
  .max(100, 'Store name must be less than 100 characters')
  .regex(
    /^[a-zA-Z0-9\s\-'.,&()]+$/,
    'Store name can only contain letters, numbers, spaces, hyphens, apostrophes, periods, commas, ampersands, and parentheses'
  )
  .transform((val) => val.trim());

/**
 * Store Address validation
 */
const storeAddressSchema = z
  .string()
  .min(1, 'Store address is required')
  .max(500, 'Store address must be less than 500 characters')
  .transform((val) => val.trim());

/**
 * Store Phone validation
 */
const storePhoneSchema = phoneSchema;

/**
 * Complete Store Schema
 */
export const StoreSchema = z.object({
  name: storeNameSchema,
  address: storeAddressSchema,
  phone: storePhoneSchema,
});

/**
 * Store Update Schema
 */
export const StoreUpdateSchema = StoreSchema.partial().extend({
  id: uuidSchema,
});

// =============================================================================
// AUTHENTICATION VALIDATION SCHEMAS
// =============================================================================

/**
 * Login Schema
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Re-authentication Schema
 */
export const ReAuthSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// =============================================================================
// FILE VALIDATION SCHEMAS
// =============================================================================

/**
 * File Upload Schema
 */
export const FileUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be less than 255 characters')
    .regex(
      /^[a-zA-Z0-9\s\-_.()]+$/,
      'File name contains invalid characters'
    )
    .transform((val) => val.trim()),
  fileSize: z
    .number()
    .min(1, 'File size must be greater than 0')
    .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  fileType: z
    .string()
    .min(1, 'File type is required')
    .regex(
      /^(image\/|application\/pdf|text\/)/,
      'Only images, PDFs, and text files are allowed'
    ),
  checkId: uuidSchema.optional(),
});

// =============================================================================
// REPORT VALIDATION SCHEMAS
// =============================================================================

/**
 * Report Filter Schema
 */
export const ReportFilterSchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => val ? new Date(val) : undefined)
    .refine(
      (date) => !date || date instanceof Date,
      'Invalid start date format'
    ),
  endDate: z
    .string()
    .optional()
    .transform((val) => val ? new Date(val) : undefined)
    .refine(
      (date) => !date || date instanceof Date,
      'Invalid end date format'
    ),
  status: z.enum(['PENDING', 'CLEARED', 'VOIDED']).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  vendorId: uuidSchema.optional(),
  bankId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'Start date must be before end date',
    path: ['endDate'],
  }
);

/**
 * Report Export Schema
 */
export const ReportExportSchema = ReportFilterSchema.extend({
  format: z.enum(['CSV', 'PDF', 'EXCEL'], {
    message: 'Export format is required',
  }),
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate and sanitize form data
 */
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
} {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Get formatted error messages from Zod error
 */
export function getFormattedErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });
  
  return errors;
}

/**
 * Check if a value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/**
 * Sanitize string input (trim and remove extra spaces)
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CheckFormData = z.infer<typeof CheckSchema>;
export type CheckUpdateData = z.infer<typeof CheckUpdateSchema>;
export type CheckVoidData = z.infer<typeof CheckVoidSchema>;

export type VendorFormData = z.infer<typeof VendorSchema>;
export type VendorUpdateData = z.infer<typeof VendorUpdateSchema>;

export type BankFormData = z.infer<typeof BankSchema>;
export type BankUpdateData = z.infer<typeof BankUpdateSchema>;
export type BankBalanceUpdateData = z.infer<typeof BankBalanceUpdateSchema>;

export type UserFormData = z.infer<typeof UserSchema>;
export type UserUpdateData = z.infer<typeof UserUpdateSchema>;
export type PasswordChangeData = z.infer<typeof PasswordChangeSchema>;
export type PasswordResetData = z.infer<typeof PasswordResetSchema>;

export type StoreFormData = z.infer<typeof StoreSchema>;
export type StoreUpdateData = z.infer<typeof StoreUpdateSchema>;

export type LoginData = z.infer<typeof LoginSchema>;
export type ReAuthData = z.infer<typeof ReAuthSchema>;

export type FileUploadData = z.infer<typeof FileUploadSchema>;

export type ReportFilterData = z.infer<typeof ReportFilterSchema>;
export type ReportExportData = z.infer<typeof ReportExportSchema>;


