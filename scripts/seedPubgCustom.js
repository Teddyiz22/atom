/**
 * Seeds product_types row: Pubg Custom (pubgcustom) with provider manual.
 * Run after: mysql < scripts/sql/add_manual_provider_enums.sql
 *
 * Usage: node scripts/seedPubgCustom.js
 *
 * Requires MySQL enums updated first:
 *   mysql ... < scripts/sql/add_manual_provider_enums.sql
 */
require('dotenv').config();
const { sequelize } = require('../config/database');
const ProductType = require('../models/ProductType');
const Product = require('../models/Product');

async function main() {
  await sequelize.authenticate();
  const [row, created] = await ProductType.findOrCreate({
    where: { provider: 'manual', typeCode: 'pubgcustom' },
    defaults: {
      name: 'Pubg Custom',
      type: 'game',
      status: 'active'
    }
  });
  if (!created) {
    await row.update({
      name: 'Pubg Custom',
      type: 'game',
      status: 'active'
    });
  }
  console.log(created ? '✅ Created Pubg Custom product type' : '✅ Updated Pubg Custom product type', row.toJSON());

  const existingCount = await Product.count({ where: { productTypeId: row.id } });
  if (existingCount === 0) {
    await Product.create({
      productTypeId: row.id,
      name: 'Sample UC pack (edit in admin)',
      diamond_amount: 60,
      price_mmk: 1000,
      price_thb: 10,
      region: 'b',
      category: null,
      is_active: true,
      is_featured: false,
      sort_order: 0
    });
    console.log('✅ Created placeholder product (adjust prices in Admin → Manual → pubgcustom)');
  }

  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
