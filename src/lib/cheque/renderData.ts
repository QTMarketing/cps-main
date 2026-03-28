/**
 * Cheque Data Structure and Validation
 * 
 * This module defines the data structure for cheque printing and provides
 * validation utilities to ensure all required fields are present.
 */

import { z } from 'zod';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ChequeAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface ChequeData {
  // Issuer Information (Store/Company writing the check)
  dbaName: string;              // Store/Company name (issuer)
  corporationName?: string | null;
  address: ChequeAddress;       // Issuer address (store/company)

  // Bank Information (Financial institution)
  bankName: string;             // Bank name (e.g., "Commercial Bank of Texas")
  routingNumber: string;
  accountNumber: string;
  merchantNumber?: string | null;

  // Check Information
  chequeNumber: string;
  date: string;
  payeeName: string;
  amount: number;
  memo: string;

  // Signature (optional - PDF generation will work without it)
  signatureImageURL?: string | null;
}

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

export const chequeDataSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  dbaName: z.string().min(1, 'DBA name is required'),
  corporationName: z.string().nullable().optional(),
  address: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(1, 'ZIP code is required'),
  }),
  routingNumber: z.string().regex(/^\d{9}$/, 'Routing number must be exactly 9 digits'),
  accountNumber: z.string().regex(/^\d+$/, 'Account number must contain only digits'),
  merchantNumber: z.string().nullable().optional(),
  chequeNumber: z.string().min(1, 'Cheque number is required'),
  date: z.string().min(1, 'Date is required'),
  payeeName: z.string().min(1, 'Payee name is required'),
  amount: z.union([z.number(), z.string()]).transform((val) => {
    const num = typeof val === 'number' ? val : Number(val);
    if (Number.isNaN(num) || num <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return num;
  }),
  memo: z.string().min(1, 'Memo is required'),
  signatureImageURL: z.string().nullable().optional(), // Optional - PDF works without signature
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validates cheque data against the schema
 */
export function validateChequeData(data: unknown): ChequeData {
  return chequeDataSchema.parse(data) as ChequeData;
}

/**
 * Formats currency amount to 2 decimal places
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Converts number to words for cheque amount
 */
export function formatAmountWords(amount: number): string {
  if (Number.isNaN(amount) || amount <= 0) return '';
  
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  
  // Simple number to words conversion
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  function convertHundreds(num: number): string {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return tens[ten] + (one > 0 ? '-' + ones[one] : '');
    }
    if (num < 1000) {
      const hundred = Math.floor(num / 100);
      const remainder = num % 100;
      return ones[hundred] + ' hundred' + (remainder > 0 ? ' ' + convertHundreds(remainder) : '');
    }
    if (num < 1000000) {
      const thousand = Math.floor(num / 1000);
      const remainder = num % 1000;
      return convertHundreds(thousand) + ' thousand' + (remainder > 0 ? ' ' + convertHundreds(remainder) : '');
    }
    return 'amount too large';
  }
  
  const words = convertHundreds(whole).toUpperCase();
  return cents > 0 
    ? `${words} AND ${cents.toString().padStart(2, '0')}/100 DOLLARS`
    : `${words} DOLLARS ONLY`;
}

/**
 * Formats date for cheque display
 */
export function formatChequeDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

