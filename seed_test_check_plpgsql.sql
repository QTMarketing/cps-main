DO $$
DECLARE
  uid text;
  bid text;
  vid text;
  vname text;
BEGIN
  SELECT id INTO uid FROM users WHERE username='admin' LIMIT 1;
  IF uid IS NULL THEN
    SELECT id INTO uid FROM users LIMIT 1;
  END IF;

  SELECT id INTO bid FROM banks ORDER BY created_at DESC LIMIT 1;
  SELECT id, vendor_name INTO vid, vname FROM vendors ORDER BY created_at DESC LIMIT 1;

  IF uid IS NULL OR bid IS NULL OR vid IS NULL THEN
    RAISE NOTICE 'Missing user/bank/vendor; cannot seed test check.';
  ELSE
    INSERT INTO checks (
      id, check_number, reference_number, payment_method, bank_id, vendor_id, payee_name, amount, memo, status, issued_by, issued_at, created_at, updated_at
    ) VALUES (
      'seed-check-0001',
      NULL,
      '1001',
      'CHECK',
      bid,
      vid,
      vname,
      123.45,
      'Test seed check',
      'ISSUED',
      uid,
      NOW(), NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
