/**
 * Validation Schema Tests
 * 
 * This file contains comprehensive tests for all validation schemas
 * to ensure they work correctly with various inputs.
 */

import { describe, it, expect } from 'vitest';
import {
  CheckSchema,
  VendorSchema,
  BankSchema,
  UserSchema,
  LoginSchema,
  ReAuthSchema,
  ReportFilterSchema,
  validateAndSanitize,
  getFormattedErrors,
} from '@/lib/validations';

// =============================================================================
// CHECK SCHEMA TESTS
// =============================================================================

describe('CheckSchema', () => {
  const validCheckData = {
    checkNumber: 'CHK001',
    amount: 1000.50,
    payeeName: 'John Doe',
    memo: 'Payment for services',
    bankId: '123e4567-e89b-12d3-a456-426614174000',
    vendorId: '123e4567-e89b-12d3-a456-426614174001',
    paymentMethod: 'Check' as const,
  };

  it('should validate correct check data', () => {
    const result = CheckSchema.safeParse(validCheckData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid check number', () => {
    const invalidData = { ...validCheckData, checkNumber: 'CHK@001' };
    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('letters, numbers, hyphens, and underscores');
    }
  });

  it('should reject negative amount', () => {
    const invalidData = { ...validCheckData, amount: -100 };
    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('positive');
    }
  });

  it('should reject amount exceeding maximum', () => {
    const invalidData = { ...validCheckData, amount: 1000000 };
    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('exceed $999,999.99');
    }
  });

  it('should reject invalid payee name', () => {
    const invalidData = { ...validCheckData, payeeName: 'John@Doe' };
    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('letters, spaces, hyphens');
    }
  });

  it('should reject invalid UUID', () => {
    const invalidData = { ...validCheckData, bankId: 'invalid-uuid' };
    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('valid UUID format');
    }
  });

  it('should reject invalid payment method', () => {
    const invalidData = { ...validCheckData, paymentMethod: 'Invalid' };
    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid payment method');
    }
  });

  it('should sanitize check number to uppercase', () => {
    const dataWithLowercase = { ...validCheckData, checkNumber: 'chk001' };
    const result = CheckSchema.parse(dataWithLowercase);
    expect(result.checkNumber).toBe('CHK001');
  });

  it('should trim whitespace from payee name', () => {
    const dataWithWhitespace = { ...validCheckData, payeeName: '  John Doe  ' };
    const result = CheckSchema.parse(dataWithWhitespace);
    expect(result.payeeName).toBe('John Doe');
  });

  it('should handle optional memo field', () => {
    const dataWithoutMemo = { ...validCheckData };
    delete dataWithoutMemo.memo;
    const result = CheckSchema.safeParse(dataWithoutMemo);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// VENDOR SCHEMA TESTS
// =============================================================================

describe('VendorSchema', () => {
  const validVendorData = {
    vendorName: 'ABC Company',
    vendorType: 'Merchandise' as const,
    description: 'Supplier of office supplies',
    contact: {
      email: 'contact@abccompany.com',
      phone: '555-123-4567',
      address: '123 Main St, City, State 12345',
    },
    storeId: '123e4567-e89b-12d3-a456-426614174000',
  };

  it('should validate correct vendor data', () => {
    const result = VendorSchema.safeParse(validVendorData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid vendor name', () => {
    const invalidData = { ...validVendorData, vendorName: 'ABC@Company' };
    const result = VendorSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid vendor type', () => {
    const invalidData = { ...validVendorData, vendorType: 'Invalid' };
    const result = VendorSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      ...validVendorData,
      contact: { ...validVendorData.contact, email: 'invalid-email' },
    };
    const result = VendorSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid phone number', () => {
    const invalidData = {
      ...validVendorData,
      contact: { ...validVendorData.contact, phone: '123' },
    };
    const result = VendorSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should require at least one contact method', () => {
    const invalidData = {
      ...validVendorData,
      contact: {},
    };
    const result = VendorSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('At least one contact method');
    }
  });

  it('should normalize phone number', () => {
    const dataWithFormattedPhone = {
      ...validVendorData,
      contact: { ...validVendorData.contact, phone: '(555) 123-4567' },
    };
    const result = VendorSchema.parse(dataWithFormattedPhone);
    expect(result.contact.phone).toBe('5551234567');
  });

  it('should convert email to lowercase', () => {
    const dataWithUppercaseEmail = {
      ...validVendorData,
      contact: { ...validVendorData.contact, email: 'CONTACT@ABCCOMPANY.COM' },
    };
    const result = VendorSchema.parse(dataWithUppercaseEmail);
    expect(result.contact.email).toBe('contact@abccompany.com');
  });
});

// =============================================================================
// BANK SCHEMA TESTS
// =============================================================================

describe('BankSchema', () => {
  const validBankData = {
    bankName: 'Bank of America',
    accountNumber: '1234567890',
    routingNumber: '123456789',
    storeId: '123e4567-e89b-12d3-a456-426614174000',
    balance: 5000.00,
  };

  it('should validate correct bank data', () => {
    const result = BankSchema.safeParse(validBankData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid bank name', () => {
    const invalidData = { ...validBankData, bankName: 'Bank@America' };
    const result = BankSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject non-numeric account number', () => {
    const invalidData = { ...validBankData, accountNumber: '123abc456' };
    const result = BankSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid routing number length', () => {
    const invalidData = { ...validBankData, routingNumber: '12345678' };
    const result = BankSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('exactly 9 digits');
    }
  });

  it('should reject negative balance', () => {
    const invalidData = { ...validBankData, balance: -100 };
    const result = BankSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('negative');
    }
  });

  it('should reject balance exceeding maximum', () => {
    const invalidData = { ...validBankData, balance: 1000000000 };
    const result = BankSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('exceed $999,999,999.99');
    }
  });

  it('should round balance to 2 decimal places', () => {
    const dataWithLongDecimal = { ...validBankData, balance: 5000.123 };
    const result = BankSchema.parse(dataWithLongDecimal);
    expect(result.balance).toBe(5000.12);
  });

  it('should trim whitespace from bank name', () => {
    const dataWithWhitespace = { ...validBankData, bankName: '  Bank of America  ' };
    const result = BankSchema.parse(dataWithWhitespace);
    expect(result.bankName).toBe('Bank of America');
  });
});

// =============================================================================
// USER SCHEMA TESTS
// =============================================================================

describe('UserSchema', () => {
  const validUserData = {
    username: 'johndoe',
    email: 'john@example.com',
    password: 'SecurePass123!',
    role: 'USER' as const,
    storeId: '123e4567-e89b-12d3-a456-426614174000',
  };

  it('should validate correct user data', () => {
    const result = UserSchema.safeParse(validUserData);
    expect(result.success).toBe(true);
  });

  it('should reject short username', () => {
    const invalidData = { ...validUserData, username: 'jo' };
    const result = UserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 3 characters');
    }
  });

  it('should reject username with special characters', () => {
    const invalidData = { ...validUserData, username: 'john@doe' };
    const result = UserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('letters, numbers, and underscores');
    }
  });

  it('should reject invalid email', () => {
    const invalidData = { ...validUserData, email: 'invalid-email' };
    const result = UserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject weak password', () => {
    const invalidData = { ...validUserData, password: 'weak' };
    const result = UserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('uppercase letter, one lowercase letter');
    }
  });

  it('should reject invalid role', () => {
    const invalidData = { ...validUserData, role: 'INVALID' };
    const result = UserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should convert username to lowercase', () => {
    const dataWithUppercaseUsername = { ...validUserData, username: 'JOHNDOE' };
    const result = UserSchema.parse(dataWithUppercaseUsername);
    expect(result.username).toBe('johndoe');
  });

  it('should convert email to lowercase', () => {
    const dataWithUppercaseEmail = { ...validUserData, email: 'JOHN@EXAMPLE.COM' };
    const result = UserSchema.parse(dataWithUppercaseEmail);
    expect(result.email).toBe('john@example.com');
  });
});

// =============================================================================
// LOGIN SCHEMA TESTS
// =============================================================================

describe('LoginSchema', () => {
  const validLoginData = {
    email: 'john@example.com',
    password: 'password123',
  };

  it('should validate correct login data', () => {
    const result = LoginSchema.safeParse(validLoginData);
    expect(result.success).toBe(true);
  });

  it('should reject empty email', () => {
    const invalidData = { ...validLoginData, email: '' };
    const result = LoginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const invalidData = { ...validLoginData, password: '' };
    const result = LoginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format', () => {
    const invalidData = { ...validLoginData, email: 'invalid-email' };
    const result = LoginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// RE-AUTH SCHEMA TESTS
// =============================================================================

describe('ReAuthSchema', () => {
  const validReAuthData = {
    password: 'currentpassword123',
  };

  it('should validate correct re-auth data', () => {
    const result = ReAuthSchema.safeParse(validReAuthData);
    expect(result.success).toBe(true);
  });

  it('should reject empty password', () => {
    const invalidData = { ...validReAuthData, password: '' };
    const result = ReAuthSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// REPORT FILTER SCHEMA TESTS
// =============================================================================

describe('ReportFilterSchema', () => {
  const validFilterData = {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    status: 'PENDING' as const,
    paymentMethod: 'Check' as const,
  };

  it('should validate correct filter data', () => {
    const result = ReportFilterSchema.safeParse(validFilterData);
    expect(result.success).toBe(true);
  });

  it('should reject start date after end date', () => {
    const invalidData = {
      ...validFilterData,
      startDate: '2024-01-31',
      endDate: '2024-01-01',
    };
    const result = ReportFilterSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Start date must be before end date');
    }
  });

  it('should handle optional fields', () => {
    const minimalData = {};
    const result = ReportFilterSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe('validateAndSanitize', () => {
  it('should return success for valid data', () => {
    const validData = {
      checkNumber: 'CHK001',
      amount: 1000.50,
      payeeName: 'John Doe',
      memo: 'Payment',
      bankId: '123e4567-e89b-12d3-a456-426614174000',
      vendorId: '123e4567-e89b-12d3-a456-426614174001',
      paymentMethod: 'Check' as const,
    };

    const result = validateAndSanitize(CheckSchema, validData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should return errors for invalid data', () => {
    const invalidData = {
      checkNumber: 'CHK@001',
      amount: -100,
      payeeName: 'John@Doe',
      memo: 'Payment',
      bankId: 'invalid-uuid',
      vendorId: '123e4567-e89b-12d3-a456-426614174001',
      paymentMethod: 'Invalid',
    };

    const result = validateAndSanitize(CheckSchema, invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('getFormattedErrors', () => {
  it('should format Zod errors correctly', () => {
    const invalidData = {
      checkNumber: 'CHK@001',
      amount: -100,
    };

    const result = CheckSchema.safeParse(invalidData);
    expect(result.success).toBe(false);

    if (!result.success) {
      const formattedErrors = getFormattedErrors(result.error);
      expect(formattedErrors).toHaveProperty('checkNumber');
      expect(formattedErrors).toHaveProperty('amount');
    }
  });
});

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

describe('Edge Cases', () => {
  it('should handle very long strings', () => {
    const longString = 'a'.repeat(101);
    const data = {
      checkNumber: 'CHK001',
      amount: 1000.50,
      payeeName: longString,
      memo: 'Payment',
      bankId: '123e4567-e89b-12d3-a456-426614174000',
      vendorId: '123e4567-e89b-12d3-a456-426614174001',
      paymentMethod: 'Check' as const,
    };

    const result = CheckSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should handle very large numbers', () => {
    const data = {
      checkNumber: 'CHK001',
      amount: 1000000,
      payeeName: 'John Doe',
      memo: 'Payment',
      bankId: '123e4567-e89b-12d3-a456-426614174000',
      vendorId: '123e4567-e89b-12d3-a456-426614174001',
      paymentMethod: 'Check' as const,
    };

    const result = CheckSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should handle special characters in various fields', () => {
    const data = {
      checkNumber: 'CHK001',
      amount: 1000.50,
      payeeName: 'John O\'Doe & Associates',
      memo: 'Payment for services',
      bankId: '123e4567-e89b-12d3-a456-426614174000',
      vendorId: '123e4567-e89b-12d3-a456-426614174001',
      paymentMethod: 'Check' as const,
    };

    const result = CheckSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should handle whitespace correctly', () => {
    const data = {
      checkNumber: '  CHK001  ',
      amount: 1000.50,
      payeeName: '  John Doe  ',
      memo: '  Payment  ',
      bankId: '123e4567-e89b-12d3-a456-426614174000',
      vendorId: '123e4567-e89b-12d3-a456-426614174001',
      paymentMethod: 'Check' as const,
    };

    const result = CheckSchema.parse(data);
    expect(result.checkNumber).toBe('CHK001');
    expect(result.payeeName).toBe('John Doe');
    expect(result.memo).toBe('Payment');
  });
});





