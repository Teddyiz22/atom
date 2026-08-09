-- Smile coin amount + rate support
-- Safe: does NOT modify smile_id_combination or existing amount/price data.
--
-- Usage:
--   mysql -u root -p nay_myo_htun_web < scripts/sql/add_smile_coin_columns.sql
--
-- Or run: node scripts/migrateSmileCoinColumns.js

-- Per Smile catalogue item: store API "price" (smile coin cost)
ALTER TABLE smile_sub_items
  ADD COLUMN IF NOT EXISTS smile_coin_amount DECIMAL(12, 2) NULL
    COMMENT 'Smile API price field (cost in smile coins)'
    AFTER amount;

-- Optional package-level total smile coins (sum of mapped sub-items). Null = not set.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS smile_coin_amount DECIMAL(12, 2) NULL
    COMMENT 'Total smile coin cost for this package (informational)'
    AFTER smile_id_combination;

-- Exchange rates: 1 smile coin → MMK / THB (by region)
CREATE TABLE IF NOT EXISTS smile_coin_rates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  region ENUM('b', 'ph') NOT NULL,
  rate_mmk DECIMAL(15, 4) NOT NULL DEFAULT 0,
  rate_thb DECIMAL(15, 4) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_smile_coin_rates_region (region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
