/**
 * Fetch-only: pull Smile One product catalogues for our smile games.
 * Does NOT write to the database.
 *
 * Games:
 *   ml     → product=mobilelegends      (BR)
 *   mcgg   → product=magicchessgogo     (Magic Chess: Go Go)  ← must be this slug
 *   mlphp  → product=mobilelegends      (PH endpoint)
 *
 * Usage:
 *   node scripts/fetchSmileProductList.js
 *   node scripts/fetchSmileProductList.js --game=mcgg
 *   node scripts/fetchSmileProductList.js --out=./tmp/smile-products.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const ML_API_URL = String(process.env.ML_API_URL || '').replace(/\/+$/, '');
const ML_API_EMAIL = process.env.ML_API_EMAIL;
const ML_API_UID = process.env.ML_API_UID;
const ML_API_KEY = process.env.ML_API_KEY;

const GAMES = {
  ml: {
    typeCode: 'ml',
    name: 'Mobile Legends',
    product: 'mobilelegends',
    region: 'b',
    path: '/smilecoin/api/productlist'
  },
  mcgg: {
    typeCode: 'mcgg',
    name: 'Magic Chess Go Go',
    // Smile requires this exact product slug (not in /product game list, but productlist works)
    product: 'magicchessgogo',
    region: 'b',
    path: '/smilecoin/api/productlist'
  },
  mcggphp: {
    typeCode: 'mcggphp',
    name: 'Magic Chess Go Go Philippines',
    product: 'magicchessgogo',
    region: 'ph',
    path: '/ph/smilecoin/api/productlist',
    extra: { country: 'ph', lang: 'en' }
  },
  mlphp: {
    typeCode: 'mlphp',
    name: 'Mobile Legend Philippines',
    product: 'mobilelegends',
    region: 'ph',
    // Note: /ph/smilecoin/api/productlist may be unavailable for some Smile accounts.
    // Script still attempts it so we can see the live response.
    path: '/ph/smilecoin/api/productlist',
    extra: { country: 'ph', lang: 'en' }
  }
};

function generateSign(params, key) {
  const sortedKeys = Object.keys(params).sort();
  let str = '';
  sortedKeys.forEach((k) => {
    str += `${k}=${params[k]}&`;
  });
  str += key;
  return crypto
    .createHash('md5')
    .update(crypto.createHash('md5').update(str).digest('hex'))
    .digest('hex');
}

function parseArgs(argv) {
  const out = { game: null, outPath: null };
  for (const arg of argv) {
    if (arg.startsWith('--game=')) out.game = String(arg.slice(7)).trim().toLowerCase();
    if (arg.startsWith('--out=')) out.outPath = String(arg.slice(6)).trim();
  }
  return out;
}

async function fetchProductList(gameCfg) {
  if (!ML_API_URL || !ML_API_EMAIL || !ML_API_UID || !ML_API_KEY) {
    throw new Error('Missing ML_API_URL / ML_API_EMAIL / ML_API_UID / ML_API_KEY in .env');
  }

  const time = Math.floor(Date.now() / 1000);
  const payload = {
    uid: ML_API_UID,
    email: ML_API_EMAIL,
    product: gameCfg.product,
    time,
    ...(gameCfg.extra || {})
  };
  payload.sign = generateSign(payload, ML_API_KEY);

  const url = `${ML_API_URL}${gameCfg.path}`;
  const response = await axios.post(url, new URLSearchParams(payload).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000
  });

  const data = response.data;
  const products = Array.isArray(data?.data?.product) ? data.data.product : [];

  return {
    typeCode: gameCfg.typeCode,
    name: gameCfg.name,
    smileProductSlug: gameCfg.product,
    region: gameCfg.region,
    requestPath: gameCfg.path,
    status: data?.status ?? null,
    message: data?.message ?? null,
    count: products.length,
    products: products.map((p) => ({
      id: String(p?.id ?? '').trim(),
      spu: String(p?.spu ?? '').trim(),
      // Smile coin cost (API field name is "price")
      smile_coin_amount: Number(p?.price ?? 0),
      cost_price: p?.cost_price != null ? Number(p.cost_price) : null,
      discount: p?.discount != null ? Number(p.discount) : null,
      raw: p
    }))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = args.game
    ? [args.game]
    : Object.keys(GAMES);

  for (const key of selected) {
    if (!GAMES[key]) {
      console.error(`Unknown game "${key}". Use: ${Object.keys(GAMES).join(', ')}`);
      process.exit(1);
    }
  }

  console.log('Fetching Smile productlist (read-only)...');
  console.log(`Base URL: ${ML_API_URL}`);
  console.log(`Games: ${selected.join(', ')}`);
  console.log('Note: mcgg uses product=magicchessgogo');
  console.log('');

  const results = {};
  for (const key of selected) {
    const cfg = GAMES[key];
    try {
      const result = await fetchProductList(cfg);
      results[key] = result;
      console.log(`=== ${result.typeCode} (${result.name}) ===`);
      console.log(`slug=${result.smileProductSlug} region=${result.region} path=${result.requestPath}`);
      console.log(`status=${result.status} count=${result.count}`);
      result.products.forEach((p) => {
        console.log(`  ${p.id.padEnd(8)} smile_coin=${String(p.smile_coin_amount).padStart(8)}  ${p.spu}`);
      });
      console.log('');
    } catch (err) {
      results[key] = {
        typeCode: cfg.typeCode,
        error: err.response?.data || err.message
      };
      console.error(`=== ${cfg.typeCode} FAILED ===`);
      console.error(err.response?.data || err.message);
      console.log('');
    }
  }

  if (args.outPath) {
    const abs = path.resolve(args.outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify({ fetchedAt: new Date().toISOString(), results }, null, 2));
    console.log(`Wrote JSON → ${abs}`);
  }

  console.log('Done (no DB writes).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
