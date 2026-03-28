-- Seed initial stores (QT stations)
-- Run this in your PostgreSQL database to create sample stores

-- Insert stores if they don't exist
INSERT INTO "Store" ("storeNumber", name, address, status, "createdAt", "updatedAt")
VALUES 
  ('126', 'QT 126', '123 Main St, City, State 12345', 'active', NOW(), NOW()),
  ('127', 'QT 127', '456 Oak Ave, City, State 12345', 'active', NOW(), NOW()),
  ('128', 'QT 128', '789 Elm St, City, State 12345', 'active', NOW(), NOW())
ON CONFLICT ("storeNumber") DO NOTHING;

-- Show created stores
SELECT * FROM "Store" ORDER BY "storeNumber";
