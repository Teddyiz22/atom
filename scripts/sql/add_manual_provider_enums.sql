-- Run once on MySQL before using manual (Pubg Custom) product type.
-- Adds 'manual' to provider enums used by ProductType and GamePurchaseTransaction.

ALTER TABLE product_types
  MODIFY COLUMN provider ENUM('smile', 'g2bulk', 'manual') NOT NULL;

ALTER TABLE game_purchase_transactions
  MODIFY COLUMN provider ENUM('g2bulk', 'smile', 'manual') NOT NULL;
