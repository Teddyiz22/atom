/**
 * Ensure 'manual' exists on provider ENUM columns.
 * Safe to re-run.
 *
 * Usage: node scripts/migrateManualProvider.js
 */
require('dotenv').config();
const { sequelize } = require('../config/database');

async function enumHasValue(table, column, value) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE AS colType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  const colType = String(rows?.[0]?.colType || '');
  return colType.includes(`'${value}'`);
}

async function main() {
  await sequelize.authenticate();
  console.log('Checking manual provider enum...');

  const patches = [
    {
      table: 'product_types',
      column: 'provider',
      ddl: `ALTER TABLE product_types MODIFY COLUMN provider ENUM('smile', 'g2bulk', 'manual') NOT NULL`
    },
    {
      table: 'game_purchase_transactions',
      column: 'provider',
      ddl: `ALTER TABLE game_purchase_transactions MODIFY COLUMN provider ENUM('g2bulk', 'smile', 'manual') NOT NULL`
    }
  ];

  for (const patch of patches) {
    if (await enumHasValue(patch.table, patch.column, 'manual')) {
      console.log(`• ${patch.table}.${patch.column} already includes manual`);
      continue;
    }
    await sequelize.query(patch.ddl);
    console.log(`✅ Updated ${patch.table}.${patch.column} to include manual`);
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error('migrateManualProvider failed:', err);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
