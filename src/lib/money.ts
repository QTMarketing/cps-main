/**
 * Money utility functions using integer cents to avoid floating-point errors.
 * All amounts are stored/calculated as integer cents.
 * 
 * Example usage:
 *   const cents = dollarsToCents("500.00");  // 50000
 *   const display = centsToDollars(50000);    // "500.00"
 */

export type Cents = number; // Always an integer representing cents

/**
 * Convert dollars (string or number) to cents (integer)
 * 
 * Examples: 
 *   "500" -> 50000
 *   "12.99" -> 1299
 *   12.5 -> 1250
 *   "0.01" -> 1
 * 
 * @throws Error if input is not a valid number
 */
export function dollarsToCents(dollars: string | number): Cents {
  const num = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid amount: ${dollars}`);
  }
  
  if (num < 0) {
    throw new Error(`Amount cannot be negative: ${dollars}`);
  }
  
  // Use Math.round to handle floating-point precision
  // 500.00 * 100 might be 49999.999999998, Math.round fixes this
  return Math.round(num * 100);
}

/**
 * Convert cents (integer) to dollars (string with 2 decimals)
 * 
 * Examples:
 *   50000 -> "500.00"
 *   1299 -> "12.99"
 *   1 -> "0.01"
 */
export function centsToDollars(cents: Cents): string {
  if (!Number.isInteger(cents)) {
    console.warn(`centsToDollars received non-integer: ${cents}, rounding`);
    cents = Math.round(cents);
  }
  return (cents / 100).toFixed(2);
}

/**
 * Convert cents to number for Prisma Decimal
 * 
 * Examples:
 *   50000 -> 500.00
 *   1299 -> 12.99
 */
export function centsToDecimal(cents: Cents): number {
  if (!Number.isInteger(cents)) {
    console.warn(`centsToDecimal received non-integer: ${cents}, rounding`);
    cents = Math.round(cents);
  }
  return cents / 100;
}

/**
 * Format cents as currency string
 * 
 * Examples:
 *   50000 -> "$500.00"
 *   1299 -> "$12.99"
 */
export function formatCents(cents: Cents): string {
  return `$${centsToDollars(cents)}`;
}

/**
 * Parse user input and convert to cents, handling various formats
 * 
 * Examples:
 *   "$500" -> 50000
 *   "500.00" -> 50000
 *   "12.99" -> 1299
 */
export function parseUserAmountToCents(input: string): Cents {
  // Remove currency symbols, commas, and whitespace
  const cleaned = input.replace(/[$,\s]/g, '');
  return dollarsToCents(cleaned);
}
