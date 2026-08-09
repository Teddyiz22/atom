/**
 * Fix MCGG BR (other server) Weekly Pass:
 * - Remove wrong PH Smile ID 23922 from mcgg product type
 * - Set Brazil Weekly Diamond Pass Smile ID 23841 (smile_coin=9.99, region=b)
 *
 * Usage: node scripts/fixMcggBrWeeklyPass.js
 */
require('dotenv').config();
const { sequelize } = require('../config/database');
const ProductType = require('../models/ProductType');
const Product = require('../models/Product');
const SmileSubItem = require('../models/SmileSubItem');

const BR_WEEKLY = {
  smileId: '23841',
  smileCoin: 9.99,
  name: 'Weekly Pass',
  region: 'b',
  category: 'WEEKLY_PASS'
};

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function main() {
  await sequelize.authenticate();

  const productType = await ProductType.findOne({
    where: { provider: 'smile', typeCode: 'mcgg' }
  });
  if (!productType) {
    throw new Error('Product type smile/mcgg not found');
  }

  // Price from existing BR bounty packs (4.00 coin → 4000 MMK / 35 THB)
  const ref = await Product.findOne({
    where: {
      productTypeId: productType.id,
      smileIDCombination: '25586',
      region: 'b'
    }
  });
  const refCoin = Number(ref?.smileCoinAmount) || 4;
  const refMmk = Number(ref?.price_mmk) || 4000;
  const refThb = Number(ref?.price_thb) || 35;
  const priceMmk = round2((BR_WEEKLY.smileCoin / refCoin) * refMmk);
  const priceThb = round2((BR_WEEKLY.smileCoin / refCoin) * refThb);

  // Remove any wrong PH weekly (23922) under mcgg
  const wrong = await Product.findAll({
    where: {
      productTypeId: productType.id,
      smileIDCombination: '23922'
    }
  });

  for (const p of wrong) {
    await SmileSubItem.destroy({ where: { productId: p.id } });
    await p.destroy();
    console.log(`✅ Removed wrong PH Weekly Pass product #${p.id} (23922) from mcgg`);
  }

  let product = await Product.findOne({
    where: {
      productTypeId: productType.id,
      smileIDCombination: BR_WEEKLY.smileId
    }
  });

  const payload = {
    productTypeId: productType.id,
    name: BR_WEEKLY.name,
    diamond_amount: BR_WEEKLY.smileCoin,
    price_mmk: priceMmk,
    price_thb: priceThb,
    category: BR_WEEKLY.category,
    smileIDCombination: BR_WEEKLY.smileId,
    smileCoinAmount: BR_WEEKLY.smileCoin,
    region: BR_WEEKLY.region,
    is_active: true,
    is_featured: true,
    sort_order: 0
  };

  if (!product) {
    product = await Product.create(payload);
    console.log(`✅ Created BR Weekly Pass product #${product.id}`);
  } else {
    await product.update(payload);
    console.log(`✅ Updated BR Weekly Pass product #${product.id}`);
  }

  // Clear any old PH sub-items on this product, then upsert BR sub-item
  await SmileSubItem.destroy({
    where: {
      productId: product.id,
      region: 'ph'
    }
  });

  const [sub, createdSub] = await SmileSubItem.findOrCreate({
    where: {
      productId: product.id,
      smileProductId: BR_WEEKLY.smileId,
      region: BR_WEEKLY.region
    },
    defaults: {
      name: 'Magic Chess: Go Go BR - Weekly Diamond Pass',
      amount: priceMmk,
      smileCoinAmount: BR_WEEKLY.smileCoin,
      status: 'active',
      sortOrder: 1
    }
  });

  if (!createdSub) {
    await sub.update({
      name: 'Magic Chess: Go Go BR - Weekly Diamond Pass',
      amount: priceMmk,
      smileCoinAmount: BR_WEEKLY.smileCoin,
      status: 'active',
      sortOrder: 1
    });
  }

  console.log('✅ BR Weekly Pass ready:', {
    productId: product.id,
    smileId: BR_WEEKLY.smileId,
    region: BR_WEEKLY.region,
    smileCoin: BR_WEEKLY.smileCoin,
    price_mmk: priceMmk,
    price_thb: priceThb
  });
  console.log('Admin: /admin/product-management/smile/mcgg');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
