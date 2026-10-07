/**
 * G2Bulk product categories + products.category_id
 *
 * - Creates product_categories table
 * - Adds products.category_id
 * - Seeds categories for pubgm / hok / mlbb_special from FE groupings
 * - Auto-attaches existing fixed G2Bulk products
 * - Seeds known static image_path values when missing
 *
 * Usage: node scripts/migrateG2bulkCategories.js
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../config/database');
const ProductType = require('../models/ProductType');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');

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

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORY_SEEDS = {
  pubgm: [
    { name: 'UC Packages', slug: 'uc-packages', sortOrder: 1, iconPath: '/images/uc.png' },
    { name: 'Pass Packages', slug: 'pass-packages', sortOrder: 2, iconPath: '/images/prime.jpg' },
    { name: 'One Time Packs', slug: 'one-time-packs', sortOrder: 3, iconPath: '/images/pubgm.png' }
  ],
  hok: [
    { name: 'Token', slug: 'token', sortOrder: 1, iconPath: '/images/toiken.png' },
    { name: 'Packages', slug: 'packages', sortOrder: 2, iconPath: '/images/double-token-bag.png' }
  ],
  mlbb_special: [
    { name: 'Pass Packages', slug: 'pass-packages', sortOrder: 1, iconPath: '/images/weekly-pass.png' },
    { name: 'Diamonds', slug: 'diamonds', sortOrder: 2, iconPath: '/images/mlbb_diamond.png' }
  ]
};

const PUBGM_ONE_TIME_KEYWORDS = [
  'First Purchase Pack',
  'Upgradable Firearm Materials Pack',
  'Mythic Emblem Pack'
];

const PUBGM_PASS_KEYWORDS = [
  'Prime',
  'Elite Pass',
  'Pack',
  'Package',
  'Prime Plus'
];

const HOK_PACKAGE_KEYWORDS = [
  'weekly',
  'pass',
  'card',
  'pack',
  'package',
  'fund',
  'bundle',
  'offer',
  'bag'
];

const MLBB_PASS_KEYWORDS = [
  'Weekly Elite Pack',
  'Monthly Elite Pack',
  'Super Value Pass',
  'Weekly'
];

const PUBGM_EXACT_IMAGES = {
  'weekly deal pack 1': '/images/dealpack1.jpg',
  'weekly deal pack 2': '/images/dealpack2.jpg',
  'prime plus': '/images/primeplus.jpg',
  'weekly mythic emblem value pack': '/images/emblem.jpg',
  'first purchase pack': '/images/first-purchase-pack.jpg',
  'upgradable firearm materials pack': '/images/firearm-materials.jpg',
  'mythic emblem pack': '/images/mythicemblem.jpg'
};

const PUBGM_KEYWORD_IMAGES = {
  prime: '/images/prime.jpg',
  elite: '/images/elite.png',
  pass: '/images/packages/pass.png',
  mythic: '/images/mythicemblem.jpg',
  emblem: '/images/mythicemblem.jpg',
  weekly: '/images/weekly.jpg'
};

const HOK_EXACT_IMAGES = {
  'honor point value pack': '/images/honor-point.png',
  'honor point value pac': '/images/hok-new-product-star.webp',
  "crimson skyblade ao'yin": '/images/hok-new-product-star.webp',
  'double token lucky bag': '/images/double-token-bag.png',
  'standard purchase rebate pack': '/images/standard-rebate-pack.png',
  'weekly card': '/images/weeklycard.png',
  'premium purchase rebate pack': '/images/premium-rebate-pack.png',
  'weekly card plus': '/images/weekly-card-plus.png'
};

const MLBB_EXACT_IMAGES = {
  'weekly elite pack': '/images/weekly-elite.png',
  'super value pass': '/images/super-value-pass.png',
  weekly: '/images/weekly-pass.png',
  'monthly elite pack': '/images/monthly-epic.png'
};

function publicImageExists(imagePath) {
  if (!imagePath) return false;
  const full = path.join(__dirname, '../public', imagePath.replace(/^\//, ''));
  return fs.existsSync(full);
}

function resolvePubgmImage(name) {
  const lower = String(name || '').toLowerCase().trim();
  if (PUBGM_EXACT_IMAGES[lower] && publicImageExists(PUBGM_EXACT_IMAGES[lower])) {
    return PUBGM_EXACT_IMAGES[lower];
  }
  for (const key of Object.keys(PUBGM_KEYWORD_IMAGES)) {
    if (lower.includes(key) && publicImageExists(PUBGM_KEYWORD_IMAGES[key])) {
      return PUBGM_KEYWORD_IMAGES[key];
    }
  }
  return publicImageExists('/images/uc.png') ? '/images/uc.png' : '/images/pubgm.png';
}

function resolveHokImage(name, isToken) {
  if (isToken) {
    return publicImageExists('/images/toiken.png') ? '/images/toiken.png' : null;
  }
  const lower = String(name || '').toLowerCase().trim();
  if (HOK_EXACT_IMAGES[lower] && publicImageExists(HOK_EXACT_IMAGES[lower])) {
    return HOK_EXACT_IMAGES[lower];
  }
  return publicImageExists('/images/double-token-bag.png') ? '/images/double-token-bag.png' : null;
}

function resolveMlbbImage(name, isPass) {
  if (!isPass) {
    return publicImageExists('/images/mlbb_diamond.png') ? '/images/mlbb_diamond.png' : null;
  }
  const lower = String(name || '').toLowerCase().trim();
  if (MLBB_EXACT_IMAGES[lower] && publicImageExists(MLBB_EXACT_IMAGES[lower])) {
    return MLBB_EXACT_IMAGES[lower];
  }
  for (const key of Object.keys(MLBB_EXACT_IMAGES)) {
    if (lower.includes(key) && publicImageExists(MLBB_EXACT_IMAGES[key])) {
      return MLBB_EXACT_IMAGES[key];
    }
  }
  return publicImageExists('/images/weekly-pass.png') ? '/images/weekly-pass.png' : null;
}

function classifyPubgm(name) {
  const n = String(name || '');
  if (PUBGM_ONE_TIME_KEYWORDS.some((k) => n.includes(k))) return 'one-time-packs';
  if (PUBGM_PASS_KEYWORDS.some((k) => n.includes(k))) return 'pass-packages';
  return 'uc-packages';
}

function classifyHok(name) {
  const n = String(name || '').trim();
  const normalized = n.toLowerCase();
  const isNumericToken = /^\d+(?:\.\d+)?$/.test(n);
  if (!isNumericToken || HOK_PACKAGE_KEYWORDS.some((k) => normalized.includes(k))) {
    return 'packages';
  }
  return 'token';
}

function classifyMlbbSpecial(name) {
  const n = String(name || '');
  if (MLBB_PASS_KEYWORDS.some((k) => n.includes(k))) return 'pass-packages';
  return 'diamonds';
}

async function ensureSchema() {
  if (!(await tableExists('product_categories'))) {
    await sequelize.query(`
      CREATE TABLE product_categories (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        product_type_id INT UNSIGNED NOT NULL,
        name VARCHAR(128) NOT NULL,
        slug VARCHAR(64) NOT NULL,
        sort_order INT UNSIGNED NOT NULL DEFAULT 0,
        icon_path VARCHAR(500) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NULL,
        updated_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_product_categories_type_slug (product_type_id, slug),
        KEY idx_product_categories_type_sort (product_type_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created product_categories table');
  } else {
    console.log('• product_categories already exists');
  }

  if (!(await columnExists('products', 'category_id'))) {
    await sequelize.query(`
      ALTER TABLE products
        ADD COLUMN category_id INT UNSIGNED NULL
          COMMENT 'FK to product_categories (G2Bulk shop sections)'
          AFTER category
    `);
    console.log('✅ Added products.category_id');
  } else {
    console.log('• products.category_id already exists');
  }
}

async function seedCategoriesForType(productType, defs) {
  const bySlug = new Map();
  for (const def of defs) {
    const [row] = await ProductCategory.findOrCreate({
      where: {
        productTypeId: productType.id,
        slug: def.slug
      },
      defaults: {
        name: def.name,
        sortOrder: def.sortOrder,
        iconPath: def.iconPath,
        isActive: true
      }
    });

    // Keep name/icon/sort in sync on re-run only when defaults were just created;
    // if already exists, leave admin edits alone except fill missing icon.
    if (!row.iconPath && def.iconPath) {
      await row.update({ iconPath: def.iconPath });
    }
    bySlug.set(def.slug, row);
  }
  return bySlug;
}

async function attachProducts(productType, typeCode, categoriesBySlug) {
  const products = await Product.findAll({
    where: { productTypeId: productType.id }
  });

  let attached = 0;
  let imaged = 0;

  for (const product of products) {
    const name = product.name || '';
    let slug;
    if (typeCode === 'pubgm') slug = classifyPubgm(name);
    else if (typeCode === 'hok') slug = classifyHok(name);
    else if (typeCode === 'mlbb_special') slug = classifyMlbbSpecial(name);
    else continue;

    const category = categoriesBySlug.get(slug);
    const updates = {};

    if (category && !product.categoryId) {
      updates.categoryId = category.id;
      attached += 1;
    }

    if (!product.image_path) {
      let imagePath = null;
      if (typeCode === 'pubgm') {
        imagePath = resolvePubgmImage(name);
        if (slug === 'uc-packages' && publicImageExists('/images/uc.png')) {
          imagePath = '/images/uc.png';
        }
      } else if (typeCode === 'hok') {
        imagePath = resolveHokImage(name, slug === 'token');
      } else if (typeCode === 'mlbb_special') {
        imagePath = resolveMlbbImage(name, slug === 'pass-packages');
      }
      if (imagePath) {
        updates.image_path = imagePath;
        imaged += 1;
      }
    }

    if (Object.keys(updates).length) {
      await product.update(updates);
    }
  }

  return { attached, imaged, total: products.length };
}

async function main() {
  await sequelize.authenticate();
  console.log('Migrating G2Bulk categories...');

  await ensureSchema();

  for (const [typeCode, defs] of Object.entries(CATEGORY_SEEDS)) {
    const productType = await ProductType.findOne({
      where: { provider: 'g2bulk', typeCode }
    });
    if (!productType) {
      console.log(`• Skipping ${typeCode}: product type not found`);
      continue;
    }

    const categoriesBySlug = await seedCategoriesForType(productType, defs);
    console.log(`✅ Seeded ${categoriesBySlug.size} categories for ${typeCode}`);

    const result = await attachProducts(productType, typeCode, categoriesBySlug);
    console.log(
      `✅ ${typeCode}: attached category to ${result.attached}/${result.total}, seeded images for ${result.imaged}`
    );
  }

  console.log('Done.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
