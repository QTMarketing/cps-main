-- Make check_number nullable (if not already)
DO $$ BEGIN
  BEGIN
    ALTER TABLE checks ALTER COLUMN check_number DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    -- column may not exist or already nullable
    NULL;
  END;
END $$;

-- Drop unique index on check_number if it exists
DO $$
DECLARE idx text;
BEGIN
  SELECT indexname INTO idx
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'checks'
    AND indexdef ILIKE '%UNIQUE%'
    AND indexdef ILIKE '%check_number%'
  LIMIT 1;
  IF idx IS NOT NULL THEN
    EXECUTE format('DROP INDEX IF EXISTS %I', idx);
  END IF;
END $$;

-- Add reference_number column if missing
ALTER TABLE checks ADD COLUMN IF NOT EXISTS reference_number text;

-- Backfill reference_number from check_number when possible
UPDATE checks
SET reference_number = check_number
WHERE reference_number IS NULL AND check_number IS NOT NULL;

-- For any remaining null reference_number, assign sequential numbers after current max
WITH maxnum AS (
  SELECT GREATEST(
    COALESCE(MAX(NULLIF(reference_number,'')::int),0),
    COALESCE(MAX(NULLIF(check_number,'')::int),0)
  ) AS m
  FROM checks
), todo AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM checks
  WHERE reference_number IS NULL
)
UPDATE checks c
SET reference_number = (SELECT (m + rn)::text FROM maxnum, todo t WHERE t.id = c.id)
WHERE c.reference_number IS NULL;

-- Add unique index on reference_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_checks_reference_number_unique ON checks(reference_number);
