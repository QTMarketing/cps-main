/** Default per-check cap for USER and STORE_USER ($3,999.00). */
export const DEFAULT_STORE_USER_CHEQUE_LIMIT_CENTS = 399_900;

/** Legacy admin per-check cap ($5,000.00). */
export const ADMIN_CHEQUE_LIMIT_CENTS = 500_000;

/**
 * Returns max cheque amount in cents for one transaction, or null if unlimited.
 *
 * `maxChequeAmountCentsFromDb` is a per-user override (cents). If it's null/undefined,
 * the store-user default is used.
 */
export function getEffectiveChequeLimitCents(
  role: string,
  maxChequeAmountCentsFromDb: number | null | undefined
): number | null {
  if (role === "SUPER_ADMIN" || role === "OFFICE_ADMIN") return null;
  if (role === "ADMIN") return ADMIN_CHEQUE_LIMIT_CENTS;
  if (role === "USER" || role === "STORE_USER") {
    return maxChequeAmountCentsFromDb ?? DEFAULT_STORE_USER_CHEQUE_LIMIT_CENTS;
  }
  return null;
}

