-- MCGG Custom (manual) — run seed script instead for full product copy:
--   node scripts/seedMcggCustom.js
--
-- This file only documents the product type row (products are copied by the seed script).

-- Ensure manual provider exists (safe to re-run if already applied):
-- source: scripts/sql/add_manual_provider_enums.sql

INSERT INTO product_types (type_code, name, provider, type, status, created_at, updated_at)
VALUES ('mcggcustom', 'MCGG Custom', 'manual', 'game', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  type = VALUES(type),
  status = VALUES(status),
  updated_at = NOW();
