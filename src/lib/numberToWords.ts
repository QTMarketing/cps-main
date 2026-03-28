import { toWords } from "number-to-words";

/**
 * Converts cents (integer) into cheque-friendly words.
 * 
 * Examples:
 *   3250 cents -> "Thirty two dollars and 50/100"
 *   50000 cents -> "Five hundred dollars"
 *   1299 cents -> "Twelve dollars and 99/100"
 * 
 * @param cents - Amount in cents (integer)
 * @returns Formatted amount in words
 */
export function formatAmountInWords(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    return "Zero dollars";
  }
  
  // Extract dollars and cents from integer cents
  const dollars = Math.floor(cents / 100);
  const centsRemainder = cents % 100;
  
  const words = toWords(dollars);
  const capitalized = words.replace(/^\w/, (char) => char.toUpperCase());
  
  if (centsRemainder === 0) {
    return `${capitalized} dollars`;
  }
  
  // Format cents with leading zero if needed (e.g., 01, 05, 50)
  const centsStr = centsRemainder.toString().padStart(2, '0');
  return `${capitalized} dollars and ${centsStr}/100`;
}

