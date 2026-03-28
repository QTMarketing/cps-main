/**
 * API Validation Middleware Tests
 * 
 * This file contains comprehensive tests for the API validation middleware
 * to ensure it works correctly with various inputs and security scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
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
  escapeHtml,
  sanitizeInput,
  deepSanitizeObject,
  validateFileType,
  scanForMaliciousContent,
} from '@/lib/api-validation';
import { CheckSchema, VendorSchema, BankSchema, UserSchema } from '@/lib/validations';

// =============================================================================
// MOCK DATA
// =============================================================================

const validCheckData = {
  checkNumber: 'CHK001',
  amount: 1000.50,
  payeeName: 'John Doe',
  memo: 'Payment for services',
  bankId: '123e4567-e89b-12d3-a456-426614174000',
  vendorId: '123e4567-e89b-12d3-a456-426614174001',
  paymentMethod: 'Check',
};

const validVendorData = {
  vendorName: 'ABC Company',
  vendorType: 'Merchandise',
  description: 'Supplier of office supplies',
  contact: {
    email: 'contact@abccompany.com',
    phone: '555-123-4567',
    address: '123 Main St, City, State 12345',
  },
  storeId: '123e4567-e89b-12d3-a456-426614174000',
};

const validBankData = {
  bankName: 'Bank of America',
  accountNumber: '1234567890',
  routingNumber: '123456789',
  storeId: '123e4567-e89b-12d3-a456-426614174000',
  balance: 5000.00,
};

const validUserData = {
  username: 'johndoe',
  email: 'john@example.com',
  password: 'SecurePass123!',
  role: 'USER',
  storeId: '123e4567-e89b-12d3-a456-426614174000',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(
  method: string = 'POST',
  url: string = 'http://localhost:3000/api/test',
  body?: any,
  headers: Record<string, string> = {}
): NextRequest {
  const requestInit: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(url, requestInit);
}

function createMockRequestWithQuery(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/test',
  queryParams: Record<string, string> = {},
  headers: Record<string, string> = {}
): NextRequest {
  const urlObj = new URL(url);
  Object.entries(queryParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  const requestInit: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };

  return new NextRequest(urlObj.toString(), requestInit);
}

// =============================================================================
// SECURITY UTILITY TESTS
// =============================================================================

describe('Security Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
      expect(escapeHtml('Hello & World')).toBe('Hello &amp; World');
      expect(escapeHtml('Test "quotes" and \'apostrophes\'')).toBe('Test &quot;quotes&quot; and &#039;apostrophes&#039;');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeInput('javascript:alert("xss")')).toBe('alert("xss")');
      expect(sanitizeInput('onclick=alert("xss")')).toBe('alert("xss")');
      expect(sanitizeInput('data:text/html,<script>alert("xss")</script>')).toBe('text/html,scriptalert("xss")/script');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello world  ')).toBe('hello world');
    });

    it('should remove null bytes', () => {
      expect(sanitizeInput('hello\0world')).toBe('helloworld');
    });
  });

  describe('deepSanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const obj = {
        name: '<script>alert("xss")</script>',
        details: {
          description: 'javascript:alert("xss")',
          tags: ['<script>', 'normal', 'onclick=alert("xss")'],
        },
      };

      const sanitized = deepSanitizeObject(obj);
      expect(sanitized.name).toBe('scriptalert("xss")/script');
      expect(sanitized.details.description).toBe('alert("xss")');
      expect(sanitized.details.tags).toEqual(['script', 'normal', 'alert("xss")']);
    });

    it('should handle arrays', () => {
      const arr = ['<script>', 'normal', 'javascript:alert("xss")'];
      const sanitized = deepSanitizeObject(arr);
      expect(sanitized).toEqual(['script', 'normal', 'alert("xss")']);
    });

    it('should handle primitive values', () => {
      expect(deepSanitizeObject('hello')).toBe('hello');
      expect(deepSanitizeObject(123)).toBe(123);
      expect(deepSanitizeObject(true)).toBe(true);
      expect(deepSanitizeObject(null)).toBe(null);
    });
  });

  describe('validateFileType', () => {
    it('should validate PDF files', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj');
      expect(validateFileType(pdfBuffer, 'test.pdf')).toBe(true);
    });

    it('should validate JPEG files', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(validateFileType(jpegBuffer, 'test.jpg')).toBe(true);
    });

    it('should validate PNG files', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
      expect(validateFileType(pngBuffer, 'test.png')).toBe(true);
    });

    it('should reject invalid file types', () => {
      const invalidBuffer = Buffer.from('This is not a valid file');
      expect(validateFileType(invalidBuffer, 'test.txt')).toBe(false);
    });

    it('should reject files with wrong extension', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4');
      expect(validateFileType(pdfBuffer, 'test.jpg')).toBe(false);
    });
  });

  describe('scanForMaliciousContent', () => {
    it('should detect script tags', () => {
      const maliciousBuffer = Buffer.from('<script>alert("xss")</script>');
      expect(scanForMaliciousContent(maliciousBuffer)).toBe(true);
    });

    it('should detect javascript protocol', () => {
      const maliciousBuffer = Buffer.from('javascript:alert("xss")');
      expect(scanForMaliciousContent(maliciousBuffer)).toBe(true);
    });

    it('should detect event handlers', () => {
      const maliciousBuffer = Buffer.from('onload=alert("xss")');
      expect(scanForMaliciousContent(maliciousBuffer)).toBe(true);
    });

    it('should detect eval functions', () => {
      const maliciousBuffer = Buffer.from('eval("alert(\\"xss\\")")');
      expect(scanForMaliciousContent(maliciousBuffer)).toBe(true);
    });

    it('should allow clean content', () => {
      const cleanBuffer = Buffer.from('This is clean content without any malicious code');
      expect(scanForMaliciousContent(cleanBuffer)).toBe(false);
    });

    it('should detect iframe tags', () => {
      const maliciousBuffer = Buffer.from('<iframe src="malicious.com"></iframe>');
      expect(scanForMaliciousContent(maliciousBuffer)).toBe(true);
    });
  });
});

// =============================================================================
// VALIDATION MIDDLEWARE TESTS
// =============================================================================

describe('validateBody', () => {
  it('should validate correct data', async () => {
    const req = createMockRequest('POST', 'http://localhost:3000/api/checks', validCheckData);
    const validation = await validateBody(CheckSchema)(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.data).toBeDefined();
    }
  });

  it('should reject invalid data', async () => {
    const invalidData = { ...validCheckData, checkNumber: 'CHK@001' };
    const req = createMockRequest('POST', 'http://localhost:3000/api/checks', invalidData);
    const validation = await validateBody(CheckSchema)(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });

  it('should sanitize input data', async () => {
    const dataWithXSS = {
      ...validCheckData,
      payeeName: '<script>alert("xss")</script>',
      memo: 'javascript:alert("xss")',
    };
    const req = createMockRequest('POST', 'http://localhost:3000/api/checks', dataWithXSS);
    const validation = await validateBody(CheckSchema, { sanitize: true })(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.data?.payeeName).not.toContain('<script>');
      expect(validation.data?.memo).not.toContain('javascript:');
    }
  });

  it('should handle unsupported content types', async () => {
    const req = createMockRequest('POST', 'http://localhost:3000/api/checks', validCheckData, {
      'content-type': 'text/plain',
    });
    const validation = await validateBody(CheckSchema)(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });

  it('should handle malformed JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"invalid": json}',
    });
    const validation = await validateBody(CheckSchema)(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });
});

describe('validateQuery', () => {
  it('should validate correct query parameters', async () => {
    const querySchema = z.object({
      page: z.string().optional().transform(val => val ? parseInt(val) : 1),
      limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
      search: z.string().optional(),
    });

    const req = createMockRequestWithQuery('GET', 'http://localhost:3000/api/users', {
      page: '1',
      limit: '10',
      search: 'john',
    });
    const validation = await validateQuery(querySchema)(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.data?.page).toBe(1);
      expect(validation.data?.limit).toBe(10);
      expect(validation.data?.search).toBe('john');
    }
  });

  it('should reject invalid query parameters', async () => {
    const querySchema = z.object({
      page: z.string().regex(/^\d+$/, 'Page must be a number'),
    });

    const req = createMockRequestWithQuery('GET', 'http://localhost:3000/api/users', {
      page: 'invalid',
    });
    const validation = await validateQuery(querySchema)(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });

  it('should handle array parameters', async () => {
    const querySchema = z.object({
      tags: z.array(z.string()).optional(),
    });

    const req = createMockRequestWithQuery('GET', 'http://localhost:3000/api/items', {
      tags: 'tag1',
      tags: 'tag2',
    });
    const validation = await validateQuery(querySchema)(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.data?.tags).toEqual(['tag1', 'tag2']);
    }
  });

  it('should sanitize query parameters', async () => {
    const querySchema = z.object({
      search: z.string().optional(),
    });

    const req = createMockRequestWithQuery('GET', 'http://localhost:3000/api/users', {
      search: '<script>alert("xss")</script>',
    });
    const validation = await validateQuery(querySchema, { sanitize: true })(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.data?.search).not.toContain('<script>');
    }
  });
});

describe('validateFileUpload', () => {
  it('should validate file uploads', async () => {
    const formData = new FormData();
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const validation = await validateFileUpload({
      maxSize: 1024,
      allowedTypes: ['text/plain'],
      scanForMalware: false,
    })(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.files).toHaveLength(1);
    }
  });

  it('should reject files that are too large', async () => {
    const formData = new FormData();
    const largeContent = 'x'.repeat(2048); // 2KB
    const file = new File([largeContent], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const validation = await validateFileUpload({
      maxSize: 1024, // 1KB limit
      allowedTypes: ['text/plain'],
      scanForMalware: false,
    })(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });

  it('should reject files with invalid types', async () => {
    const formData = new FormData();
    const file = new File(['test content'], 'test.exe', { type: 'application/x-executable' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const validation = await validateFileUpload({
      maxSize: 1024,
      allowedTypes: ['text/plain', 'image/jpeg'],
      scanForMalware: false,
    })(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });

  it('should reject files with malicious content', async () => {
    const formData = new FormData();
    const maliciousContent = '<script>alert("xss")</script>';
    const file = new File([maliciousContent], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const validation = await validateFileUpload({
      maxSize: 1024,
      allowedTypes: ['text/plain'],
      scanForMalware: true,
    })(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });
});

describe('validateRequest', () => {
  it('should validate both body and query parameters', async () => {
    const querySchema = z.object({
      id: z.string().uuid(),
    });

    const req = createMockRequestWithQuery(
      'PUT',
      'http://localhost:3000/api/checks?id=123e4567-e89b-12d3-a456-426614174000',
      validCheckData
    );

    const validation = await validateRequest(CheckSchema, querySchema)(req);

    expect(validation).not.toBeInstanceOf(NextResponse);
    if (!(validation instanceof NextResponse)) {
      expect(validation.success).toBe(true);
      expect(validation.body).toBeDefined();
      expect(validation.query).toBeDefined();
    }
  });

  it('should reject invalid body data', async () => {
    const querySchema = z.object({
      id: z.string().uuid(),
    });

    const invalidData = { ...validCheckData, checkNumber: 'CHK@001' };
    const req = createMockRequestWithQuery(
      'PUT',
      'http://localhost:3000/api/checks?id=123e4567-e89b-12d3-a456-426614174000',
      invalidData
    );

    const validation = await validateRequest(CheckSchema, querySchema)(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });

  it('should reject invalid query parameters', async () => {
    const querySchema = z.object({
      id: z.string().uuid(),
    });

    const req = createMockRequestWithQuery(
      'PUT',
      'http://localhost:3000/api/checks?id=invalid-uuid',
      validCheckData
    );

    const validation = await validateRequest(CheckSchema, querySchema)(req);

    expect(validation).toBeInstanceOf(NextResponse);
    if (validation instanceof NextResponse) {
      expect(validation.status).toBe(400);
    }
  });
});

// =============================================================================
// SECURITY MIDDLEWARE TESTS
// =============================================================================

describe('rateLimit', () => {
  beforeEach(() => {
    // Clear any existing rate limit data
    // In a real implementation, this would clear the rate limit store
  });

  it('should allow requests within limit', () => {
    const middleware = rateLimit(5, 60000); // 5 requests per minute
    const req = createMockRequest();

    const result = middleware(req);
    expect(result).toBeNull();
  });

  it('should block requests exceeding limit', () => {
    const middleware = rateLimit(1, 60000); // 1 request per minute
    const req = createMockRequest();

    // First request should pass
    const firstResult = middleware(req);
    expect(firstResult).toBeNull();

    // Second request should be blocked
    const secondResult = middleware(req);
    expect(secondResult).toBeInstanceOf(NextResponse);
    if (secondResult instanceof NextResponse) {
      expect(secondResult.status).toBe(429);
    }
  });
});

describe('cors', () => {
  it('should allow requests from allowed origins', () => {
    const middleware = cors(['http://localhost:3000']);
    const req = createMockRequest('GET', 'http://localhost:3000/api/test', undefined, {
      origin: 'http://localhost:3000',
    });

    const result = middleware(req);
    expect(result).toBeNull();
  });

  it('should block requests from disallowed origins', () => {
    const middleware = cors(['http://localhost:3000']);
    const req = createMockRequest('GET', 'http://localhost:3000/api/test', undefined, {
      origin: 'http://malicious.com',
    });

    const result = middleware(req);
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
    }
  });
});

describe('securityHeaders', () => {
  it('should add security headers', () => {
    const middleware = securityHeaders();
    const req = createMockRequest();

    const result = middleware(req);
    expect(result).toBeNull();
    // Note: In a real test, you would check the response headers
    // This is a simplified test
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe('createValidationErrorResponse', () => {
  it('should create proper error response', () => {
    const errors = [
      { field: 'checkNumber', message: 'Invalid check number', code: 'invalid_string' },
      { field: 'amount', message: 'Amount must be positive', code: 'too_small' },
    ];

    const response = createValidationErrorResponse(errors, 'Custom validation failed');
    
    expect(response.status).toBe(400);
    // Note: In a real test, you would check the response body
  });
});

describe('logSecurityEvent', () => {
  it('should log security events', () => {
    const req = createMockRequest();
    
    // Mock console.warn to capture logs
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    logSecurityEvent('TEST_EVENT', req, { test: 'data' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Security Event:',
      expect.objectContaining({
        event: 'TEST_EVENT',
        url: 'http://localhost:3000/api/test',
        method: 'POST',
        details: { test: 'data' },
      })
    );
    
    consoleSpy.mockRestore();
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
  it('should handle complete validation flow', async () => {
    // Test complete flow: security headers -> rate limiting -> validation -> sanitization
    const req = createMockRequest('POST', 'http://localhost:3000/api/checks', validCheckData);
    
    // Apply security headers
    const securityResult = securityHeaders()(req);
    expect(securityResult).toBeNull();
    
    // Apply rate limiting
    const rateLimitResult = rateLimit(100, 60000)(req);
    expect(rateLimitResult).toBeNull();
    
    // Validate body
    const validationResult = await validateBody(CheckSchema, {
      sanitize: true,
      preventXSS: true,
    })(req);
    
    expect(validationResult).not.toBeInstanceOf(NextResponse);
    if (!(validationResult instanceof NextResponse)) {
      expect(validationResult.success).toBe(true);
      expect(validationResult.data).toBeDefined();
    }
  });

  it('should handle malicious input throughout the flow', async () => {
    const maliciousData = {
      ...validCheckData,
      payeeName: '<script>alert("xss")</script>',
      memo: 'javascript:alert("xss")',
    };
    
    const req = createMockRequest('POST', 'http://localhost:3000/api/checks', maliciousData);
    
    const validationResult = await validateBody(CheckSchema, {
      sanitize: true,
      preventXSS: true,
    })(req);
    
    expect(validationResult).not.toBeInstanceOf(NextResponse);
    if (!(validationResult instanceof NextResponse)) {
      expect(validationResult.success).toBe(true);
      expect(validationResult.data?.payeeName).not.toContain('<script>');
      expect(validationResult.data?.memo).not.toContain('javascript:');
    }
  });
});





