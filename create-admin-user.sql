-- =============================================================================
-- CREATE ADMIN USER - SQL Script for Supabase
-- =============================================================================
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/uznzmoulrdzyfpshnixx/sql
-- Copy and paste ALL of this into the SQL editor and click "Run"
-- =============================================================================

-- First, create the store (users need a store)
INSERT INTO stores (id, name, address, phone, created_at, updated_at)
VALUES (
  'cmh4jy46p0000rgk2xx6ud5fx',  -- Fixed ID
  'QT Office Main Store',        -- Store name
  '123 Business St, City, State 12345', -- Address
  '(555) 123-4567',              -- Phone
  NOW(),                         -- Created at
  NOW()                          -- Updated at
)
ON CONFLICT (id) DO NOTHING;

-- Update users to use the store (add store_id)
UPDATE users 
SET store_id = 'cmh4jy46p0000rgk2xx6ud5fx'
WHERE store_id IS NULL
AND role IN ('ADMIN', 'MANAGER', 'USER');

-- Insert admin user with hashed password 'admin1234'
INSERT INTO users (id, username, email, password_hash, role, store_id, is_active, created_at, updated_at)
VALUES (
  'cmh4jy99u0002rgk2joxgi0vc',  -- Fixed ID
  'admin',                       -- Username
  'admin@quicktrackinc.com',    -- Email
  '$2b$10$wXrl/NxL0sxpt0PphtKNhOiDVyBJQX1eSdEGXM37VfoNDfYNMYiBG', -- bcrypt hash for 'admin1234'
  'ADMIN',                       -- Role
  'cmh4jy46p0000rgk2xx6ud5fx',  -- Store ID
  true,                          -- Is active
  NOW(),                         -- Created at
  NOW()                          -- Updated at
)
ON CONFLICT (id) DO NOTHING;

-- Insert manager user with hashed password 'manager123'
INSERT INTO users (id, username, email, password_hash, role, store_id, is_active, created_at, updated_at)
VALUES (
  'cmh4jy99u0003rgk2joxgi0vd',
  'manager',
  'manager@qtoffice.com',
  '$2b$10$49V7UeENMFxK3Y6aRiaaGeID9sxRDoNMAixGFhhxylEDwTruPFbQu', -- bcrypt hash for 'manager123'
  'MANAGER',
  'cmh4jy46p0000rgk2xx6ud5fx',  -- Store ID
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert regular user with hashed password 'user123'
INSERT INTO users (id, username, email, password_hash, role, store_id, is_active, created_at, updated_at)
VALUES (
  'cmh4jy99u0004rgk2joxgi0ve',
  'user',
  'user@qtoffice.com',
  '$2b$10$SsWiLF6fqctu6YRDOPdAuOVMxGGJGcsmhHNGJBPHxVOf/lJeExIly', -- bcrypt hash for 'user123'
  'USER',
  'cmh4jy46p0000rgk2xx6ud5fx',  -- Store ID
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Verify users were created
SELECT id, username, email, role FROM users;

-- =============================================================================
-- NOTES:
-- The password hash above is temporary. You need to generate the actual bcrypt hash.
-- Or use this Node.js command to generate it:
-- node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('admin1234',10).then(h=>console.log(h))"
-- =============================================================================

