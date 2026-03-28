-- Insert one test check using existing admin (or any user) as issuer
WITH issuer AS (
  SELECT id FROM users WHERE username='admin' LIMIT 1
  UNION ALL
  SELECT id FROM users WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='admin') LIMIT 1
), bank AS (
  SELECT id FROM banks ORDER BY created_at DESC LIMIT 1
), vend AS (
  SELECT id, vendor_name FROM vendors ORDER BY created_at DESC LIMIT 1
)
INSERT INTO checks (
  id, check_number, reference_number, payment_method, bank_id, vendor_id, payee_name, amount, memo, status, issued_by, issued_at, created_at, updated_at
)
SELECT 
  '55555555-5555-5555-5555-555555555555',
  NULL,
  '1001',
  'CHECK',
  (SELECT id FROM bank),
  (SELECT id FROM vend),
  (SELECT vendor_name FROM vend),
  123.45,
  'Test seed check',
  'ISSUED',
  (SELECT id FROM issuer),
  NOW(), NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM issuer) AND EXISTS (SELECT 1 FROM bank) AND EXISTS (SELECT 1 FROM vend)
ON CONFLICT (id) DO NOTHING;
