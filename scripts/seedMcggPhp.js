/**
 * Seed Magic Chess Go Go Philippines (mcggphp) product type + PH Smile packages.
 *
 * Source: Smile /ph/smilecoin/api/productlist product=magicchessgogo
 *
 * Usage: node scripts/seedMcggPhp.js
 */
require('dotenv').config();
const { sequelize } = require('../config/database');
const ProductType = require('../models/ProductType');
const Product = require('../models/Product');
const SmileSubItem = require('../models/SmileSubItem');
const SmileCoinRate = require('../models/SmileCoinRate');

// From Z-note/smile_all_games_region_variants.txt (PH path)
const PH_PACKAGES = [
  { id: '23906', price: 4.75, spu: 'Magic Chess: Go Go PH - diamond_5', diamonds: 5, category: 'DIAMOND' },
  { id: '23907', price: 9.03, spu: 'Magic Chess: Go Go PH - diamond_11', diamonds: 11, category: 'DIAMOND' },
  { id: '23908', price: 18.05, spu: 'Magic Chess: Go Go PH - diamond_22', diamonds: 22, category: 'DIAMOND' },
  { id: '23909', price: 45.13, spu: 'Magic Chess: Go Go PH - diamond_56', diamonds: 56, category: 'DIAMOND' },
  { id: '23918', price: 47.45, spu: 'Magic Chess: Go Go PH - diamond_55', diamonds: 55, category: 'DIAMOND' },
  { id: '23910', price: 90.25, spu: 'Magic Chess: Go Go PH - diamond_112', diamonds: 112, category: 'DIAMOND' },
  { id: '23919', price: 140.60, spu: 'Magic Chess: Go Go PH - diamond_165', diamonds: 165, category: 'DIAMOND' },
  { id: '23911', price: 180.50, spu: 'Magic Chess: Go Go PH - diamond_223', diamonds: 223, category: 'DIAMOND' },
  { id: '23920', price: 233.70, spu: 'Magic Chess: Go Go PH - diamond_275', diamonds: 275, category: 'DIAMOND' },
  { id: '23912', price: 270.75, spu: 'Magic Chess: Go Go PH - diamond_336', diamonds: 336, category: 'DIAMOND' },
  { id: '23921', price: 473.10, spu: 'Magic Chess: Go Go PH - diamond_565', diamonds: 565, category: 'DIAMOND' },
  { id: '23913', price: 451.25, spu: 'Magic Chess: Go Go PH - diamond_570', diamonds: 570, category: 'DIAMOND' },
  { id: '23914', price: 902.50, spu: 'Magic Chess: Go Go PH - diamond_1163', diamonds: 1163, category: 'DIAMOND' },
  { id: '23915', price: 1805.00, spu: 'Magic Chess: Go Go PH - diamond_2398', diamonds: 2398, category: 'DIAMOND' },
  { id: '23916', price: 4512.50, spu: 'Magic Chess: Go Go PH - diamond_6042', diamonds: 6042, category: 'DIAMOND' },
  { id: '25600', price: 47.45, spu: "Magic Chess: Go Go PH - Lukas's Battle Bounty", diamonds: null, category: 'WEEKLY_PASS', name: "Lukas's Battle Bounty" },
  { id: '25601', price: 47.45, spu: 'Magic Chess: Go Go PH - Battle for Discounts', diamonds: null, category: 'WEEKLY_PASS', name: 'Battle for Discounts' },
  { id: '25602', price: 53.15, spu: 'Magic Chess: Go Go PH - Promotion Bounty', diamonds: null, category: 'WEEKLY_PASS', name: 'Promotion Bounty' },
  { id: '23922', price: 95.00, spu: 'Magic Chess: Go Go PH - Weekly Diamond Pass', diamonds: null, category: 'WEEKLY_PASS', name: 'Weekly Pass' }
];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function main() {
  await sequelize.authenticate();

  // Ensure PH smile coin rate exists (approx from existing mlphp pricing ~84 MMK / coin)
  const [phRate] = await SmileCoinRate.findOrCreate({
    where: { region: 'ph' },
    defaults: { rate_mmk: 85, rate_thb: 0.75, is_active: true }
  });
  let rateMmk = Number(phRate.rate_mmk);
  let rateThb = Number(phRate.rate_thb);
  if (!rateMmk || rateMmk <= 0) {
    await phRate.update({ rate_mmk: 85, rate_thb: rateThb > 0 ? rateThb : 0.75 });
    rateMmk = 85;
    rateThb = rateThb > 0 ? rateThb : 0.75;
    console.log('✅ Set smile_coin_rates ph rate_mmk=85 rate_thb=', rateThb);
  } else {
    console.log('• Using smile_coin_rates ph:', rateMmk, rateThb);
  }

  const [productType, createdType] = await ProductType.findOrCreate({
    where: { provider: 'smile', typeCode: 'mcggphp' },
    defaults: {
      name: 'Magic Chess Go Go Philippines',
      type: 'game',
      status: 'active'
    }
  });
  if (!createdType) {
    await productType.update({
      name: 'Magic Chess Go Go Philippines',
      type: 'game',
      status: 'active'
    });
  }
  console.log(createdType ? '✅ Created product type mcggphp' : '✅ Updated product type mcggphp', `#${productType.id}`);

  let created = 0;
  let updated = 0;

  for (let i = 0; i < PH_PACKAGES.length; i++) {
    const pack = PH_PACKAGES[i];
    const smileCoin = Number(pack.price);
    const name = pack.name || (pack.diamonds != null ? `${pack.diamonds} Dia` : pack.spu);
    const diamondAmount = pack.diamonds != null ? pack.diamonds : smileCoin;
    const priceMmk = round2(smileCoin * rateMmk);
    const priceThb = round2(smileCoin * rateThb);

    let product = await Product.findOne({
      where: {
        productTypeId: productType.id,
        smileIDCombination: String(pack.id)
      }
    });

    const payload = {
      productTypeId: productType.id,
      name,
      diamond_amount: diamondAmount,
      price_mmk: priceMmk,
      price_thb: priceThb,
      category: pack.category,
      smileIDCombination: String(pack.id),
      smileCoinAmount: smileCoin,
      region: 'ph',
      is_active: true,
      is_featured: false,
      sort_order: i + 1
    };

    if (!product) {
      product = await Product.create(payload);
      created += 1;
    } else {
      await product.update(payload);
      updated += 1;
    }

    const [sub] = await SmileSubItem.findOrCreate({
      where: {
        productId: product.id,
        smileProductId: String(pack.id),
        region: 'ph'
      },
      defaults: {
        name: pack.spu,
        amount: priceMmk,
        smileCoinAmount: smileCoin,
        status: 'active',
        sortOrder: 1
      }
    });
    await sub.update({
      name: pack.spu,
      amount: priceMmk,
      smileCoinAmount: smileCoin,
      status: 'active',
      sortOrder: 1
    });
  }

  console.log(`✅ Products created=${created} updated=${updated}`);
  console.log('Admin: /admin/product-management/smile/mcggphp');
  console.log('Shop:   /shop/mcggphp');
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
