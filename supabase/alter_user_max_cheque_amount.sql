-- Per-user override for max cheque amount (cents) for USER / STORE_USER.
-- NULL = use application default ($3,999.00 per check).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "max_cheque_amount_cents" INTEGER;

