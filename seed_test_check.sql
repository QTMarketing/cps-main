-- Create minimal seed data and one test check
-- IDs are fixed for repeatability; statements use ON CONFLICT DO NOTHING where possible

-- Store
INSERT INTO stores (id, name, address, phone, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'QT Office Main Store', '123 Business St', '(555) 123-4567', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Admin user
INSERT INTO users (id, username, email, password_hash, role, store_id, is_active, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'admin',
  'admin@quicktrackinc.com',
  '$2b$10$wXrl/NxL0sxpt0PphtKNhOiDVyBJQX1eSdEGXM37VfoNDfYNMYiBG', -- bcrypt for 'admin1234'
  'ADMIN',
  '11111111-1111-1111-1111-111111111111',
  true,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Bank
INSERT INTO banks (id, bank_name, account_number, routing_number, account_type, store_id, balance, is_active, created_at, updated_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'First National Bank',
  '1234567890',
  '021000021',
  'CHECKING',
  '11111111-1111-1111-1111-111111111111',
  50000.00,
  true,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Vendor
INSERT INTO vendors (id, vendor_name, vendor_type, description, contact_person, email, phone, address, store_id, is_active, created_at, updated_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Test Vendor',
  'MERCHANDISE',
  'Seed vendor',
  'John Doe',
  'vendor@test.com',
  '555-000-0000',
  '456 Vendor Rd',
  '11111111-1111-1111-1111-111111111111',
  true,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Test check
INSERT INTO checks (
  id, check_number, reference_number, payment_method, bank_id, vendor_id, payee_name, amount, memo, status, issued_by, issued_at, created_at, updated_at
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  NULL,
  '1001',
  'CHECK',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  'Test Vendor',
  123.45,
  'Test seed check',
  'ISSUED',
  '22222222-2222-2222-2222-222222222222',
  NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

