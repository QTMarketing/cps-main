/**
 * Comprehensive API Validation Middleware
 * 
 * This module provides server-side validation, sanitization, and security
 * middleware for all API routes in the QT Office Check Printing System.
 * Never trust client-side validation alone - always validate on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAndSanitize, getFormattedErrors } from '@/lib/validations';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface FileValidationOptions {
  maxSize: number; // in bytes
  allowedTypes: string[];
  scanForMalware?: boolean;
}

export interface ValidationMiddlewareOptions {
  sanitize?: boolean;
  preventXSS?: boolean;
  validateFile?: FileValidationOptions;
  logValidationErrors?: boolean;
}

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Escape HTML entities to prevent XSS attacks
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Remove dangerous characters and patterns
 */
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/expression\(/gi, '') // Remove CSS expressions
    .replace(/url\(/gi, '') // Remove CSS url() functions
    .replace(/\0/g, ''); // Remove null bytes
}

/**
 * Deep sanitize object recursively
 */
function deepSanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepSanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deepSanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate file type by checking magic bytes
 */
function validateFileType(buffer: Buffer, filename: string): boolean {
  const fileExtension = filename.split('.').pop()?.toLowerCase();
  
  // Check magic bytes for common file types
  const magicBytes: Record<string, number[]> = {
    'pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'jpg': [0xFF, 0xD8, 0xFF], // JPEG
    'jpeg': [0xFF, 0xD8, 0xFF], // JPEG
    'png': [0x89, 0x50, 0x4E, 0x47], // PNG
    'gif': [0x47, 0x49, 0x46], // GIF
    'doc': [0xD0, 0xCF, 0x11, 0xE0], // DOC
    'docx': [0x50, 0x4B, 0x03, 0x04], // DOCX (ZIP-based)
    'xls': [0xD0, 0xCF, 0x11, 0xE0], // XLS
    'xlsx': [0x50, 0x4B, 0x03, 0x04], // XLSX (ZIP-based)
  };

  if (!fileExtension || !magicBytes[fileExtension]) {
    return false;
  }

  const expectedBytes = magicBytes[fileExtension];
  return expectedBytes.every((byte, index) => buffer[index] === byte);
}

/**
 * Scan file for malicious content patterns
 */
function scanForMaliciousContent(buffer: Buffer): boolean {
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024)); // Check first 1KB
  
  const maliciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /onclick=/i,
    /eval\(/i,
    /document\./i,
    /window\./i,
    /alert\(/i,
    /confirm\(/i,
    /prompt\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<applet/i,
  ];

  return maliciousPatterns.some(pattern => pattern.test(content));
}

// =============================================================================
// VALIDATION MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * Validate request body against Zod schema
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  options: ValidationMiddlewareOptions = {}
): (req: NextRequest) => Promise<NextResponse | ValidationResult<T>> {
  return async (req: NextRequest): Promise<NextResponse | ValidationResult<T>> => {
    try {
      // Parse request body
      let body: any;
      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        body = await req.json();
      } else if (contentType.includes('multipart/form-data')) {
        // Handle multipart form data
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
      } else {
        return NextResponse.json(
          { 
            error: 'Unsupported content type',
            message: 'Only JSON, form-data, and URL-encoded data are supported'
          },
          { status: 400 }
        );
      }

      // Sanitize input if enabled
      if (options.sanitize !== false) {
        body = deepSanitizeObject(body);
      }

      // Validate against schema
      const validation = validateAndSanitize(schema, body);

      if (!validation.success) {
        const errors: ValidationError[] = validation.errors!.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        // Log validation errors if enabled
        if (options.logValidationErrors !== false) {
          console.warn('Validation failed:', {
            url: req.url,
            method: req.method,
            errors: errors,
            body: body,
          });
        }

        return NextResponse.json(
          {
            error: 'Validation failed',
            message: 'Request data does not meet validation requirements',
            details: errors,
          },
          { status: 400 }
        );
      }

      // XSS prevention if enabled
      if (options.preventXSS !== false) {
        const sanitizedData = deepSanitizeObject(validation.data);
        return { success: true, data: sanitizedData };
      }

      return { success: true, data: validation.data };

    } catch (error) {
      console.error('Validation middleware error:', error);
      
      return NextResponse.json(
        {
          error: 'Invalid request body',
          message: 'Failed to parse request body',
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Validate URL query parameters against Zod schema
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  options: ValidationMiddlewareOptions = {}
): (req: NextRequest) => Promise<NextResponse | ValidationResult<T>> {
  return async (req: NextRequest): Promise<NextResponse | ValidationResult<T>> => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams: any = {};

      // Convert URLSearchParams to object
      for (const [key, value] of searchParams.entries()) {
        // Handle array parameters (e.g., ?tags=tag1&tags=tag2)
        if (queryParams[key]) {
          if (Array.isArray(queryParams[key])) {
            queryParams[key].push(value);
          } else {
            queryParams[key] = [queryParams[key], value];
          }
        } else {
          queryParams[key] = value;
        }
      }

      // Sanitize query parameters if enabled
      if (options.sanitize !== false) {
        Object.keys(queryParams).forEach(key => {
          if (typeof queryParams[key] === 'string') {
            queryParams[key] = sanitizeInput(queryParams[key]);
          } else if (Array.isArray(queryParams[key])) {
            queryParams[key] = queryParams[key].map((item: string) => 
              typeof item === 'string' ? sanitizeInput(item) : item
            );
          }
        });
      }

      // Validate against schema
      const validation = validateAndSanitize(schema, queryParams);

      if (!validation.success) {
        const errors: ValidationError[] = validation.errors!.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        // Log validation errors if enabled
        if (options.logValidationErrors !== false) {
          console.warn('Query validation failed:', {
            url: req.url,
            method: req.method,
            errors: errors,
            queryParams: queryParams,
          });
        }

        return NextResponse.json(
          {
            error: 'Query validation failed',
            message: 'URL parameters do not meet validation requirements',
            details: errors,
          },
          { status: 400 }
        );
      }

      return { success: true, data: validation.data };

    } catch (error) {
      console.error('Query validation middleware error:', error);
      
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: 'Failed to parse URL parameters',
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Validate file uploads with security checks
 */
export function validateFileUpload(
  options: FileValidationOptions = {
    maxSize: 10 * 1024 * 1024, // 10MB default
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    scanForMalware: true,
  }
): (req: NextRequest) => Promise<NextResponse | { success: true; files: File[] }> {
  return async (req: NextRequest): Promise<NextResponse | { success: true; files: File[] }> => {
    try {
      const contentType = req.headers.get('content-type') || '';
      
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json(
          {
            error: 'Invalid content type',
            message: 'File uploads must use multipart/form-data',
          },
          { status: 400 }
        );
      }

      const formData = await req.formData();
      const files: File[] = [];
      const errors: ValidationError[] = [];

      // Process all files in the form data
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const file = value;

          // Check file size
          if (file.size > options.maxSize) {
            errors.push({
              field: key,
              message: `File size exceeds maximum allowed size of ${options.maxSize / (1024 * 1024)}MB`,
              code: 'FILE_TOO_LARGE',
            });
            continue;
          }

          // Check file type
          if (!options.allowedTypes.includes(file.type)) {
            errors.push({
              field: key,
              message: `File type ${file.type} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
              code: 'INVALID_FILE_TYPE',
            });
            continue;
          }

          // Validate file type by magic bytes
          const buffer = Buffer.from(await file.arrayBuffer());
          if (!validateFileType(buffer, file.name)) {
            errors.push({
              field: key,
              message: `File type does not match file extension for ${file.name}`,
              code: 'FILE_TYPE_MISMATCH',
            });
            continue;
          }

          // Scan for malicious content
          if (options.scanForMalware && scanForMaliciousContent(buffer)) {
            errors.push({
              field: key,
              message: `File ${file.name} contains potentially malicious content`,
              code: 'MALICIOUS_CONTENT',
            });
            continue;
          }

          files.push(file);
        }
      }

      if (errors.length > 0) {
        return NextResponse.json(
          {
            error: 'File validation failed',
            message: 'One or more files failed validation',
            details: errors,
          },
          { status: 400 }
        );
      }

      return { success: true, files };

    } catch (error) {
      console.error('File validation middleware error:', error);
      
      return NextResponse.json(
        {
          error: 'File upload validation failed',
          message: 'Failed to process uploaded files',
        },
        { status: 400 }
      );
    }
  };
}

// =============================================================================
// COMBINED VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Combined validation middleware for body and query parameters
 */
export function validateRequest<TBody, TQuery>(
  bodySchema: z.ZodSchema<TBody>,
  querySchema?: z.ZodSchema<TQuery>,
  options: ValidationMiddlewareOptions = {}
): (req: NextRequest) => Promise<NextResponse | { success: true; body: TBody; query?: TQuery }> {
  return async (req: NextRequest): Promise<NextResponse | { success: true; body: TBody; query?: TQuery }> => {
    try {
      // Validate body
      const bodyValidation = await validateBody(bodySchema, options)(req);
      if (bodyValidation instanceof NextResponse) {
        return bodyValidation;
      }

      // Validate query parameters if schema provided
      let queryValidation: any = undefined;
      if (querySchema) {
        const queryResult = await validateQuery(querySchema, options)(req);
        if (queryResult instanceof NextResponse) {
          return queryResult;
        }
        queryValidation = queryResult.data;
      }

      return {
        success: true,
        body: bodyValidation.data!,
        query: queryValidation,
      };

    } catch (error) {
      console.error('Combined validation middleware error:', error);
      
      return NextResponse.json(
        {
          error: 'Request validation failed',
          message: 'Failed to validate request data',
        },
        { status: 400 }
      );
    }
  };
}

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

/**
 * Rate limiting middleware
 */
export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): (req: NextRequest) => NextResponse | null {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: NextRequest): NextResponse | null => {
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const now = Date.now();
    const userRequests = requests.get(ip);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return null;
    }

    if (userRequests.count >= maxRequests) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000} seconds`,
        },
        { status: 429 }
      );
    }

    userRequests.count++;
    return null;
  };
}

/**
 * CORS middleware
 */
export function cors(
  allowedOrigins: string[] = ['http://localhost:3000'],
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: string[] = ['Content-Type', 'Authorization']
): (req: NextRequest) => NextResponse | null {
  return (req: NextRequest): NextResponse | null => {
    const origin = req.headers.get('origin');
    
    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { error: 'CORS policy violation' },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(): (req: NextRequest) => NextResponse | null {
  return (req: NextRequest): NextResponse | null => {
    const response = NextResponse.next();
    
    // Set security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    return null;
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create validation error response
 */
export function createValidationErrorResponse(
  errors: ValidationError[],
  message: string = 'Validation failed'
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      message,
      details: errors,
    },
    { status: 400 }
  );
}

/**
 * Extract client IP address
 */
export function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  req: NextRequest,
  details?: any
): void {
  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  console.warn('Security Event:', {
    event,
    ip,
    userAgent,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    details,
  });
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type ValidationMiddleware<T> = (req: NextRequest) => Promise<NextResponse | ValidationResult<T>>;
export type FileValidationMiddleware = (req: NextRequest) => Promise<NextResponse | { success: true; files: File[] }>;
export type SecurityMiddleware = (req: NextRequest) => NextResponse | null;


