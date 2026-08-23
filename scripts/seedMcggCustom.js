/**
 * Seed MCGG Custom — manual product type with same packages as smile/mcgg
 * (Magic Chess Go Go other server).
 *
 * Usage: node scripts/seedMcggCustom.js
 *        (or: npm run migrate)
 */
require('dotenv').config();
const { sequelize } = require('../config/database');
const ProductType = require('../models/ProductType');
const Product = require('../models/Product');

const SOURCE = { provider: 'smile', typeCode: 'mcgg' };
const TARGET = {
  provider: 'manual',
  typeCode: 'mcggcustom',
  name: 'MCGG Custom'
};

async function main() {
  await sequelize.authenticate();

  const sourceType = await ProductType.findOne({ where: SOURCE });
  if (!sourceType) {
    throw new Error(`Source product type not found: ${SOURCE.provider}/${SOURCE.typeCode}`);
  }

  const [targetType, createdType] = await ProductType.findOrCreate({
    where: { provider: TARGET.provider, typeCode: TARGET.typeCode },
    defaults: {
      name: TARGET.name,
      type: 'game',
      status: 'active'
    }
  });
  if (!createdType) {
    await targetType.update({
      name: TARGET.name,
      type: 'game',
      status: 'active'
    });
  }
  console.log(createdType ? '✅ Created product type mcggcustom' : '✅ Updated product type mcggcustom', `#${targetType.id}`);

  const sourceProducts = await Product.findAll({
    where: { productTypeId: sourceType.id },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  if (!sourceProducts.length) {
    throw new Error('No source products found on smile/mcgg. Seed mcgg packages first.');
  }

  let created = 0;
  let updated = 0;

  for (const src of sourceProducts) {
    const payload = {
      productTypeId: targetType.id,
      name: src.name,
      diamond_amount: src.diamond_amount,
      price_mmk: src.price_mmk,
      price_thb: src.price_thb,
      category: src.category,
      region: src.region || 'b',
      smileIDCombination: null,
      smileCoinAmount: null,
      is_active: src.is_active,
      is_featured: src.is_featured,
      sort_order: src.sort_order,
      image_path: src.image_path
    };

    let product = await Product.findOne({
      where: {
        productTypeId: targetType.id,
        name: src.name,
        category: src.category || null
      }
    });

    if (!product) {
      await Product.create(payload);
      created += 1;
    } else {
      await product.update(payload);
      updated += 1;
    }
  }

  console.log(`✅ Products created=${created} updated=${updated} (copied from smile/mcgg)`);
  console.log('Admin: /admin/product-management/manual/mcggcustom');
  console.log('Shop:   /shop/mcggcustom');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
