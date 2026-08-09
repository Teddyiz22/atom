/**
 * Migrate Smile coin columns (does NOT change smile_id_combination or sell prices).
 *
 * Adds:
 *   - smile_sub_items.smile_coin_amount
 *   - products.smile_coin_amount
 *   - smile_coin_rates table (region → rate_mmk / rate_thb)
 *
 * Usage: node scripts/migrateSmileCoinColumns.js
 */
require('dotenv').config();
const { sequelize } = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function tableExists(table) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    { replacements: [table] }
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function main() {
  await sequelize.authenticate();
  console.log('Migrating Smile coin columns...');

  if (!(await columnExists('smile_sub_items', 'smile_coin_amount'))) {
    await sequelize.query(`
      ALTER TABLE smile_sub_items
        ADD COLUMN smile_coin_amount DECIMAL(12, 2) NULL
          COMMENT 'Smile API price field (cost in smile coins)'
          AFTER amount
    `);
    console.log('✅ Added smile_sub_items.smile_coin_amount');
  } else {
    console.log('• smile_sub_items.smile_coin_amount already exists');
  }

  if (!(await columnExists('products', 'smile_coin_amount'))) {
    await sequelize.query(`
      ALTER TABLE products
        ADD COLUMN smile_coin_amount DECIMAL(12, 2) NULL
          COMMENT 'Total smile coin cost for this package (informational)'
          AFTER smile_id_combination
    `);
    console.log('✅ Added products.smile_coin_amount');
  } else {
    console.log('• products.smile_coin_amount already exists');
  }

  if (!(await tableExists('smile_coin_rates'))) {
    await sequelize.query(`
      CREATE TABLE smile_coin_rates (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        region ENUM('b', 'ph') NOT NULL,
        rate_mmk DECIMAL(15, 4) NOT NULL DEFAULT 0,
        rate_thb DECIMAL(15, 4) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NULL,
        updated_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_smile_coin_rates_region (region)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created smile_coin_rates table');
  } else {
    console.log('• smile_coin_rates already exists');
  }

  // Seed default BR rate only if empty (does not overwrite)
  const [rateRows] = await sequelize.query(`SELECT COUNT(*) AS c FROM smile_coin_rates`);
  if (Number(rateRows?.[0]?.c || 0) === 0) {
    const now = new Date();
    await sequelize.query(
      `INSERT INTO smile_coin_rates (region, rate_mmk, rate_thb, is_active, created_at, updated_at)
       VALUES ('b', 800.0000, 0.0000, 1, ?, ?),
              ('ph', 0.0000, 0.0000, 1, ?, ?)`,
      { replacements: [now, now, now, now] }
    );
    console.log('✅ Seeded default smile_coin_rates (b=800 MMK/coin placeholder; adjust in admin later)');
  }

  console.log('Done. Existing smile_id_combination / prices left unchanged.');
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
