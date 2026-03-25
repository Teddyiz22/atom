const Product = require('../models/Product');
const G2BulkItem = require('../models/G2BulkItem');
const SmileSubItem = require('../models/SmileSubItem');
const ProductType = require('../models/ProductType');
const axios = require('axios');

/**
 * Customer-facing shops: if a product_types row exists for provider+typeCode and it is
 * inactive, hide/disable that game. If no row exists (legacy), allow (do not block).
 */
async function isProductTypeActiveForCustomer(provider, typeCode) {
  const tc = String(typeCode || '').trim().toLowerCase();
  if (!tc) return false;
  const row = await ProductType.findOne({ where: { provider, typeCode: tc } });
  if (!row) return true;
  return row.status === 'active';
}
const crypto = require('crypto');
const loggingService = require('../services/loggingService');
const { logUserActivity } = require('../services/loggingService');

// In-memory user order locks to prevent concurrent orders from same user
const userOrderLocks = new Map();

// Helper function to acquire user lock
const acquireUserLock = (userId) => {
  if (userOrderLocks.has(userId)) {
    return false; // Lock already exists
  }
  userOrderLocks.set(userId, Date.now());
  return true;
};

// Helper function to release user lock
const releaseUserLock = (userId) => {
  userOrderLocks.delete(userId);
};

// Cleanup old locks (older than 5 minutes)
setInterval(() => {
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  for (const [userId, timestamp] of userOrderLocks.entries()) {
    if (timestamp < fiveMinutesAgo) {
      userOrderLocks.delete(userId);
    }
  }
}, 60000); // Run cleanup every minute

// ML API Configuration
const ML_API_URL = process.env.ML_API_URL;
const ML_API_EMAIL = process.env.ML_API_EMAIL;
const ML_API_UID = process.env.ML_API_UID;
const ML_API_KEY = process.env.ML_API_KEY;
const ML_API_PRODUCT = process.env.ML_API_PRODUCT;

// Signature generator for ML API
function generateSign(params, key) {
  const sortedKeys = Object.keys(params).sort();
  let str = '';
  sortedKeys.forEach(k => {
    str += `${k}=${params[k]}&`;
  });
  str += key;
  return crypto.createHash('md5').update(
    crypto.createHash('md5').update(str).digest('hex')
  ).digest('hex');
}

// Get role info from ML API
async function smileOneGetRoleInfo({ userid, zoneid, productid, productSlug, region }) {
  let roleUrl = `${ML_API_URL}/smilecoin/api/getrole`;
  const time = Math.floor(Date.now() / 1000);

  // Handle region-specific endpoint
  if (region === 'ph') {
    roleUrl = `${ML_API_URL}/ph/smilecoin/api/getrole`;
  }

  const payload = {
    uid: ML_API_UID,
    email: ML_API_EMAIL,
    userid,
    zoneid,
    product: productSlug || ML_API_PRODUCT,
    productid,
    time
  };

  // Add region-specific parameters
  if (region === 'ph') {
    payload.country = 'ph';
    payload.lang = 'en';
  } else if (region) {
    // If other region is passed but not 'ph', still pass it if needed by API
    // payload.region = region; // Keeping original logic or adjusting based on requirements
    // For now, only 'ph' triggers special endpoint/params based on zkl_web logic
  }

  // Original logic had:
  // if (region) {
  //   payload.region = region;
  // }
  // We'll keep this for non-ph regions if they rely on it, but 'ph' uses country/lang
  if (region && region !== 'ph') {
     payload.region = region;
  }

  payload.sign = generateSign(payload, ML_API_KEY);

  try {
    console.log("Role Info Request Payload:", payload);
    const response = await axios.post(roleUrl, new URLSearchParams(payload).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log("Role Info Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Role Info Error:", error.response?.data || error.message);
    throw error;
  }
}

// Create order with ML API
async function smileOneCreateOrder({ userid, zoneid, productid, productSlug, region }) {
  let apiUrl = `${ML_API_URL}/smilecoin/api/createorder`;
  const time = Math.floor(Date.now() / 1000);

  // Handle region-specific endpoint
  if (region === 'ph') {
    apiUrl = `${ML_API_URL}/ph/smilecoin/api/createorder`;
  }

  const payload = {
    uid: ML_API_UID,
    email: ML_API_EMAIL,
    userid,
    zoneid,
    product: productSlug || ML_API_PRODUCT,
    productid,
    time
  };

  // Add region-specific parameters
  if (region === 'ph') {
    payload.country = 'PH';
    payload.lang = 'en';
  }

  payload.sign = generateSign(payload, ML_API_KEY);

  try {
    const response = await axios.post(apiUrl, new URLSearchParams(payload).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log("Order Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Order Error:", error.response?.data || error.message);
    throw error;
  }
}

// Send order confirmation email
async function sendOrderConfirmationEmail({ user, product, purchase, userid, zoneid, amount, currency, newBalance, orders }) {
  try {
    const emailService = require('../services/emailService');

    // Create purchase object with properly formatted data for email template
    const purchaseForEmail = {
      id: purchase.id,
      product_name: product.name,
      total_price: amount, // Use the amount parameter instead of purchase.amount
      currency: currency,
      createdAt: purchase.created_at || new Date(),
      ml_username: purchase.ml_username || 'Not Available',
      ml_user_id: userid,
      ml_zone_id: zoneid,
      status: purchase.status
    };

    // Ensure newBalance is a valid number
    const formattedNewBalance = isNaN(newBalance) ? 0 : newBalance;

    await emailService.sendPurchaseConfirmationEmail(user.email, user.name, purchaseForEmail, formattedNewBalance);
    console.log('Purchase confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending purchase confirmation email:', error);
    // Re-throw the error so it can be caught by the calling function
    throw error;
  }
}

function getG2BulkClientOrThrow() {
  const rawBaseUrl = String(process.env.G2BULK_API_URL || '').trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const apiKey = String(process.env.G2BULK_API_KEY || '').trim();
  if (!baseUrl || !apiKey) {
    throw new Error('Missing G2BULK API configuration.');
  }

  return axios.create({
    baseURL: baseUrl,
    timeout: 15000,
    headers: { 'X-API-Key': apiKey, 'x-api-key': apiKey, 'Authorization': `Bearer ${apiKey}` }
  });
}

async function g2bulkFetchFields(gameCode) {
  const client = getG2BulkClientOrThrow();
  const res = await client.post('/games/fields', { game: String(gameCode || '') });
  const data = res?.data || {};
  const info = data?.info && typeof data.info === 'object' ? data.info : {};
  const fields = Array.isArray(info.fields) ? info.fields : [];
  const notes = info?.notes ? String(info.notes) : '';
  return { fields, notes, raw: data };
}

async function g2bulkCheckPlayerId(gameCode, payload) {
  const client = getG2BulkClientOrThrow();
  // Map mlbb_special to mlbb for verification
  // const verificationGameCode = gameCode === 'mlbb_special' ? 'mlbb' : gameCode;
  const res = await client.post('/games/checkPlayerId', { game: String(gameCode || ''), ...(payload || {}) });
  return { raw: res?.data };
}

async function g2bulkCreateOrder(gameCode, payload) {
  const client = getG2BulkClientOrThrow();
  try {
    const res = await client.post(`/games/${encodeURIComponent(String(gameCode || ''))}/order`, payload || {});
    return { raw: res?.data };
  } catch (error) {
    const data = error?.response?.data;
    if (data) return { raw: data };
    throw error;
  }
}

function normalizeCallbackBaseUrl(req) {
  const rawEnv = String(process.env.WEBSITE_URL || '').trim();
  const envUrl = rawEnv.replace(/\/+$/, '');
  if (envUrl) return envUrl;

  const forwardedProto = String(req.headers && (req.headers['x-forwarded-proto'] || req.headers['X-Forwarded-Proto']) || '').split(',')[0].trim();
  const proto = forwardedProto || (req.protocol || 'http');
  const host = req.get && req.get('host') ? String(req.get('host')) : '';
  if (!host) return '';
  return `${proto}://${host}`;
}

function normalizeG2BulkStatus(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'PENDING') return 'pending';
  if (s === 'PROCESSING' || s === 'IN_PROGRESS' || s === 'IN PROGRESS') return 'processing';
  if (s === 'COMPLETED' || s === 'SUCCESS' || s === 'SUCCESSFUL' || s === 'COMPLETE' || s === 'DONE' || s === 'DELIVERED') return 'completed';
  if (s === 'FAILED' || s === 'FAIL' || s === 'ERROR' || s === 'CANCELLED' || s === 'CANCELED' || s === 'REJECTED') return 'fail';
  return null;
}

async function getActiveUsdRates() {
  // Hardcoded rates since ExchangeRate model is deleted
  const usdToMmk = 5300;
  const usdToThb = 34;
  return { usdToMmk, usdToThb };
}

function g2bulkExtractPlayerFields(fields) {
  const f = fields && typeof fields === 'object' ? fields : {};
  const playerId = String(f.player_id || f.user_id || f.userid || '').trim();
  const serverIdRaw = Object.prototype.hasOwnProperty.call(f, 'server_id') ? f.server_id : (Object.prototype.hasOwnProperty.call(f, 'zone_id') ? f.zone_id : null);
  const serverId = (serverIdRaw === null || typeof serverIdRaw === 'undefined' || String(serverIdRaw).trim() === '') ? '' : String(serverIdRaw).trim();
  return { playerId, serverId };
}

function g2bulkIsValidPlayerCheck(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  if (d.success === true) return true;
  if (d.valid === true) return true;
  if (typeof d.valid === 'string' && d.valid.toLowerCase() === 'valid') return true;
  if (typeof d.status === 'string' && d.status.toLowerCase() === 'ok') return true;
  return false;
}

function g2bulkPlayerCheckMessage(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const msg = d.message || d.msg || d.error || d.errors || d.reason || '';
  if (Array.isArray(msg)) return msg.filter(Boolean).map(v => String(v)).join(', ');
  if (msg && typeof msg === 'object') return Object.values(msg).filter(Boolean).map(v => String(v)).join(', ');
  return msg ? String(msg) : '';
}

async function sendG2BulkStatusEmail({ user, tx, playerName, walletAfter }) {
  const emailService = require('../services/emailService');
  if (!user || !user.email) return;

  const payload = {
    id: tx.id,
    provider: 'g2bulk',
    game_code: tx.product_type_code,
    product_name: tx.product_name,
    total_price: Number(tx.total_amount || 0),
    currency: tx.currency,
    status: tx.status,
    order_id: tx.order_id || null,
    player_id: tx.player_id || null,
    server_id: tx.server_id || null,
    player_name: playerName || null,
    createdAt: tx.created_at || new Date()
  };

  await emailService.sendGameOrderStatusEmail(user.email, user.name, payload, walletAfter);
}

const mlController = {
  // GET / - Home page
  index: (req, res) => {
    try {
      // Get success message data
      const successData = {
        message: req.session.successMessage || null,
        isRegistration: req.session.registrationSuccess || false,
        isLogin: req.session.loginSuccess || false
      };

      // Clear the success messages from session after reading
      delete req.session.successMessage;
      delete req.session.registrationSuccess;
      delete req.session.loginSuccess;

      res.render('ml/index', {
        title: 'ATOM Game Shop - Your Diamond Store | Top up in seconds, play for hours',
        description: 'ATOM Game Shop - Your trusted diamond store since March 2022. Buy Mobile Legends, PUBG, Honor of Kings diamonds with MMK currency. 5.0 star rating from 26.1k+ customers. Affordable prices, balanced service.',
        keywords: 'ATOM Game Shop, Mobile Legends diamonds, ML diamonds, PUBG diamonds, Honor of Kings, diamond top up, Myanmar gaming, MMK currency, 5 star reviews, affordable gaming, balanced service, gaming store',
        user: req.session.user || null,
        successData: successData,
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
      });
    } catch (error) {
      console.error('Error in ML index:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // GET /about - About Us page
  about: (req, res) => {
    try {
      res.render('ml/about', {
        title: 'About ATOM Game Shop - Founded March 2022 | 5.0 Star Diamond Store',
        description: 'About ATOM Game Shop - Founded March 30, 2022 on Facebook. Your trusted diamond store with 5.0 star rating from 26.1k+ customers. Specializing in Mobile Legends, PUBG, Honor of Kings with affordable prices and balanced service in Myanmar.',
        keywords: 'About ATOM Game Shop, diamond store history, March 2022 founded, 5.0 star reviews, 26.1k customers, Facebook gaming store, Myanmar diamond store, affordable prices, balanced service, Mobile Legends store',
        user: req.session.user || null,
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
      });
    } catch (error) {
      console.error('Error in about page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  shopTypes: async (req, res) => {
    try {
      if (req.session.user) {
        await logUserActivity(req.session.user.id, 'SHOP_TYPES_PAGE_ACCESS', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      const productTypes = await ProductType.findAll({
        where: { status: 'active' },
        order: [['type', 'ASC'], ['name', 'ASC']]
      });

      res.render('ml/shop', {
        title: 'Shop - Choose Game or Product Type | ATOM Game Shop',
        description: 'Select your game to buy diamonds instantly with MMK currency.',
        keywords: 'Mobile Legends, PUBG, Honor of Kings, game top up, diamond shop, product types',
        user: req.session.user || null,
        productTypes,
        products: [],
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600',
        mode: 'types'
      });
    } catch (error) {
      console.error('Error in shop types page:', error);
      if (req.session.user) {
        await loggingService.logError(req.session.user.id, 'SHOP_TYPES_PAGE_ERROR', error, {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong loading the shop.'
      });
    }
  },

  shop: async (req, res) => {
    try {
      if (req.session.user) {
        await logUserActivity(req.session.user.id, 'SHOP_PAGE_ACCESS', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      const typeCode = String(req.params.typeCode || '').trim();

      const rawProvider = String(req.query.provider || '').trim().toLowerCase();
      const provider = rawProvider || (await (async () => {
        const foundType = await ProductType.findOne({
          where: { typeCode, status: 'active' }
        });
        return foundType ? foundType.provider : null;
      })());

      if (!provider) {
        return res.status(404).render('errors/404', {
          title: 'Page Not Found',
          message: 'The selected game or product type was not found.'
        });
      }

      const normalizedTypeCode = typeCode.toLowerCase();
      let productType = await ProductType.findOne({
        where: { provider, typeCode: normalizedTypeCode }
      });
      if (!productType && normalizedTypeCode !== typeCode) {
        productType = await ProductType.findOne({
          where: { provider, typeCode }
        });
      }

      if (!productType && provider === 'g2bulk') {
        const displayName = (() => {
          if (normalizedTypeCode === 'pubgm') return 'PUBG Mobile';
          if (normalizedTypeCode === 'hok') return 'Honor of Kings';
          if (normalizedTypeCode === 'mcgg') return 'Marvel Contest of Champions';
          if (normalizedTypeCode === 'mlbb_special') return 'Mobile Legends Special';
          if (normalizedTypeCode === 'ml') return 'Mobile Legends';
          if (normalizedTypeCode === 'mlphp') return 'Mobile Legends PH';
          return normalizedTypeCode;
        })();

        const [pt] = await ProductType.findOrCreate({
          where: { provider: 'g2bulk', typeCode: normalizedTypeCode },
          defaults: { name: displayName, type: 'game', status: 'active' }
        });
        productType = pt;
      }

      if (!productType) {
        return res.status(404).render('errors/404', {
          title: 'Page Not Found',
          message: 'The selected game or product type was not found.'
        });
      }

      if (productType.status !== 'active') {
        return res.status(404).render('errors/404', {
          title: 'Page Not Found',
          message: 'This game or product type is not available at the moment.',
          showTelegramSupport: true
        });
      }

      let products = [];
      const isG2bulk = provider === 'g2bulk';

      if (isG2bulk) {
        const rawBaseUrl = String(process.env.G2BULK_API_URL || '').trim();
        const baseUrl = rawBaseUrl.replace(/\/+$/, '');
        const apiKey = String(process.env.G2BULK_API_KEY || '').trim();
        if (!baseUrl || !apiKey) {
          return res.status(500).render('errors/500', {
            title: 'Server Error',
            message: 'Missing G2BULK API configuration.'
          });
        }

        const client = axios.create({
          baseURL: baseUrl,
          timeout: 15000,
          headers: { 'X-API-Key': apiKey, 'x-api-key': apiKey, 'Authorization': `Bearer ${apiKey}` }
        });

        let apiProducts = [];
        try {
          const catalogueRes = await client.get(`/games/${encodeURIComponent(normalizedTypeCode)}/catalogue`);
          const data = catalogueRes?.data;
          
          if (data && data.status === 200 && Array.isArray(data.products)) {
             apiProducts = data.products;
          } else if (Array.isArray(data)) {
            apiProducts = data;
          } else if (Array.isArray(data?.items)) {
            apiProducts = data.items;
          } else if (Array.isArray(data?.catalogues)) {
            apiProducts = data.catalogues;
          }
        } catch (error) {
          return res.status(500).render('errors/500', {
            title: 'Server Error',
            message: 'Failed to load products from provider.'
          });
        }

        // Get stored products for pricing
        const storedProducts = await Product.findAll({
          where: { productTypeId: productType.id, is_active: true }
        });

        // Use a Set to track added product IDs to prevent duplicates
        const addedProductIds = new Set();

        // Map API products but use stored prices
        products = (Array.isArray(apiProducts) ? apiProducts : []).map(p => {
          const id = String(p?.id ?? p?.product_id ?? p?.code ?? '').trim();
          const name = String(p?.name ?? p?.product_name ?? p?.title ?? '').trim();
          
          // Find matching stored product to get fixed price
          // We check against fixed_product_id mapping if possible, or fallback to matching logic
          // But currently G2BulkItem mapping is the reliable link. 
          // However, here we only have the `Product` table loaded.
          // The admin controller logic saves products with `name` matching the API product name.
          // So we try to match by name if ID doesn't match directly (which it won't for virtual G2Bulk items vs local DB IDs).
          
          // Note: In adminController, we create a Product record. 
          // The G2BulkItem mapping links the API ID to the Product ID.
          // Ideally we should fetch G2BulkItem mappings here too, but to keep it simple and consistent with current logic:
          // We rely on the fact that we are filtering by `productTypeId`.
          // And we match based on the name stored in the DB which should match the API name.
          
          const stored = storedProducts.find(sp => sp.name === name);
          
          if (!stored) return null; // Only show configured products
          
          // Deduplication check
          if (addedProductIds.has(stored.id)) {
            return null;
          }
          addedProductIds.add(stored.id);

          return {
            id: stored.id,
            name: stored.name,
            diamond_amount: stored.diamond_amount,
            price_mmk: stored.price_mmk,
            price_thb: stored.price_thb,
            is_featured: stored.is_featured,
            sort_order: stored.sort_order
          };
        }).filter(Boolean);
        
        // Sort products
        products.sort((a, b) => {
           if (a.is_featured !== b.is_featured) return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
           if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
           return a.diamond_amount - b.diamond_amount;
        });

      } else {
        products = await Product.findAll({
          where: { is_active: true, productTypeId: productType.id },
          order: [
            ['is_featured', 'DESC'],
            ['sort_order', 'ASC'],
            ['diamond_amount', 'ASC']
          ]
        });
      }

      const viewName = (() => {
        const code = normalizedTypeCode;
        if (code === 'hok') return 'ml/shop-hok';
        if (code === 'mcgg') return 'ml/shop-mcgg';
        if (code === 'mlbb_special') return 'ml/shop-mlbb_special';
        if (code === 'ml') return 'ml/shop-ml';
        if (code === 'mlphp') return 'ml/shop-mlphp';
        if (code === 'pubgm') return 'ml/shop-pubgm';
        return 'ml/shop';
      })();

      res.render(viewName, {
        title: `Shop - ${productType.name} | ATOM Game Shop`,
        description: `Buy ${productType.name} packages instantly with MMK currency at ATOM Game Shop.`,
        keywords: `${productType.name} diamonds, ${productType.name} top up, ATOM Game Shop`,
        user: req.session.user || null,
        products,
        productType,
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600',
        csrfToken: res.locals.csrfToken
      });
    } catch (error) {
      console.error('Error in shop page:', error);
      if (req.session.user) {
        await loggingService.logError(req.session.user.id, 'SHOP_PAGE_ERROR', error, {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong loading the shop.'
      });
    }
  },

  // GET /order - Order page
  order: async (req, res) => {
    try {
      // Log order page access
      if (req.session.user) {
        await logUserActivity(req.session.user.id, 'ORDER_PAGE_ACCESS', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      // Redirect to the main shop page since dedicated order view does not exist
      return res.redirect('/shop');
    } catch (error) {
      console.error('Error in order page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // POST /order - Process order
  processOrder: (req, res) => {
    try {
      const { userId, serverId, whatsapp, diamond_package, payment_method } = req.body;

      // Basic validation
      if (!userId || !serverId || !whatsapp || !diamond_package || !payment_method) {
        return res.redirect('/shop?error=All%20fields%20are%20required');
      }

      // Validate ML User ID format
      if (!/^\d{6,12}$/.test(userId)) {
        return res.redirect('/shop?error=Invalid%20ML%20User%20ID%20format');
      }

      // Here you would typically process the order with payment gateway
      console.log('Order processed:', { userId, serverId, whatsapp, diamond_package, payment_method });

      return res.redirect('/shop?success=Order%20submitted%20successfully');
    } catch (error) {
      console.error('Error processing order:', error);
      res.render('ml/order', {
        title: 'Order Diamonds - ML Diamonds Store',
        user: req.session.user || null,
        error: 'Something went wrong. Please try again.'
      });
    }
  },

  // GET /profile - Profile page
  profile: async (req, res) => {
    try {
      // Check if user is logged in
      if (!req.session.user) {
        return res.redirect('/users/login');
      }

      // Get user purchases data
      const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
      const User = require('../models/User');

      // Get fresh user data from database
      const user = await User.findByPk(req.session.user.id);
      if (!user) {
        req.session.destroy();
        return res.redirect('/users/login');
      }

      // Get user's purchases
      const rawPurchases = await GamePurchaseTransaction.findAll({
        where: { user_id: req.session.user.id },
        order: [['created_at', 'DESC']]
      });

      const purchases = rawPurchases.map(purchase => ({
        id: purchase.id,
        product_name: purchase.product_name,
        product_type_code: purchase.product_type_code,
        game_name: getGameNameFromTypeCode(purchase.product_type_code),
        provider: purchase.provider,
        category: null,
        ml_userid: purchase.player_id,
        ml_zoneid: purchase.server_id,
        ml_username: null,
        amount: parseFloat(purchase.total_amount),
        currency: purchase.currency,
        status: purchase.status,
        created_at: purchase.created_at,
        ml_order_id: purchase.order_id
      }));

      const userStats = {
        totalOrders: rawPurchases.length,
        totalSpentMMK: 0,
        totalSpentTHB: 0
      };

      rawPurchases.forEach(purchase => {
        if (!['completed', 'success', 'partial_success'].includes(purchase.status)) return;
        const amount = parseFloat(purchase.total_amount || 0);
        if (purchase.currency === 'MMK') userStats.totalSpentMMK += amount;
        if (purchase.currency === 'THB') userStats.totalSpentTHB += amount;
      });

      // Debug logging
      console.log('🔍 Profile debug - User ID:', req.session.user.id);
      console.log('🔍 Profile debug - Purchases count:', purchases ? purchases.length : 0);
      console.log('🔍 Profile debug - User stats:', userStats);

      res.render('ml/profile', {
        title: 'My Profile - ATOM Game Shop | Gaming Account Dashboard',
        description: 'Manage your ATOM Game Shop profile, view purchase history, track diamond orders for Mobile Legends, PUBG, Honor of Kings. Your secure gaming account dashboard.',
        keywords: 'ATOM Game Shop profile, gaming account, purchase history, diamond orders, Mobile Legends account, PUBG profile, gaming dashboard',
        user: user.toJSON(),
        purchases: purchases || [],
        userStats: userStats || { totalOrders: 0, totalSpentMMK: 0, totalSpentTHB: 0 },
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
      });
    } catch (error) {
      console.error('Error in profile page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  orderhistory: async (req, res) => {
    try {
      // Check if user is logged in
      if (!req.session.user) {
        return res.redirect('/users/login');
      }

      // Get user purchases data
      const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
      const User = require('../models/User');

      // Get fresh user data from database
      const user = await User.findByPk(req.session.user.id);
      if (!user) {
        req.session.destroy();
        return res.redirect('/users/login');
      }

      // Get user's purchases
      const rawPurchases = await GamePurchaseTransaction.findAll({
        where: { user_id: req.session.user.id },
        order: [['created_at', 'DESC']]
      });

      const purchases = rawPurchases.map(purchase => ({
        id: purchase.id,
        product_name: purchase.product_name,
        product_type_code: purchase.product_type_code,
        game_name: getGameNameFromTypeCode(purchase.product_type_code),
        provider: purchase.provider,
        category: null,
        ml_userid: purchase.player_id,
        ml_zoneid: purchase.server_id,
        ml_username: null,
        amount: parseFloat(purchase.total_amount),
        currency: purchase.currency,
        status: purchase.status,
        created_at: purchase.created_at,
        ml_order_id: purchase.order_id
      }));

      const userStats = {
        totalOrders: rawPurchases.length,
        totalSpentMMK: 0,
        totalSpentTHB: 0
      };

      rawPurchases.forEach(purchase => {
        if (!['completed', 'success', 'partial_success'].includes(purchase.status)) return;
        const amount = parseFloat(purchase.total_amount || 0);
        if (purchase.currency === 'MMK') userStats.totalSpentMMK += amount;
        if (purchase.currency === 'THB') userStats.totalSpentTHB += amount;
      });

      res.render('ml/orderhistory', {
        title: 'My Order History - ATOM Game Shop | Gaming Account Dashboard',
        description: 'Manage your ATOM Game Shop profile, view purchase history, track diamond orders for Mobile Legends, PUBG, Honor of Kings. Your secure gaming account dashboard.',
        keywords: 'ATOM Game Shop profile, gaming account, purchase history, diamond orders, Mobile Legends account, PUBG profile, gaming dashboard',
        user: user.toJSON(),
        purchases: purchases || [],
        userStats: userStats || { totalOrders: 0, totalSpentMMK: 0, totalSpentTHB: 0 },
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
      });
    } catch (error) {
      console.error('Error in profile page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // GET /wallet - Wallet page
  wallet: (req, res) => {
    try {
      // Check if user is logged in
      if (!req.session.user) {
        return res.redirect('/users/login');
      }

      res.render('ml/wallet', {
        title: 'My Wallet - ATOM Game Shop | Gaming Balance & Transactions',
        description: 'Manage your ATOM Game Shop wallet, add balance with MMK currency, view transaction history for diamond purchases. Secure payment system for Mobile Legends, PUBG, Honor of Kings.',
        keywords: 'ATOM Game Shop wallet, gaming balance, MMK transactions, diamond payment, Mobile Legends wallet, PUBG balance, gaming payment system',
        user: req.session.user,
        balance: 0, // This would come from database
        transactions: [], // This would come from database
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
      });
    } catch (error) {
      console.error('Error in wallet page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // GET /faq - FAQ page
  guide: (req, res) => {
    try {
      res.render('ml/guide', {
        title: 'Guide - ML Diamonds Store',
        description: 'Step-by-step guide for wallet top-up and diamond purchases on ATOM Game Shop.',
        user: req.session.user || null,
        websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
      });
    } catch (error) {
      console.error('Error in Guide page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  disclaimer: (req, res) => {
    res.render('ml/disclaimer', {
      title: 'Disclaimer - ATOM Game Shop',
      user: req.session.user || null,
      websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
    });
  },

  privacyPolicy: (req, res) => {
    res.render('ml/privacy-policy', {
      title: 'Privacy Policy - ATOM Game Shop',
      user: req.session.user || null,
      websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
    });
  },

  termsAndConditions: (req, res) => {
    res.render('ml/terms-and-conditions', {
      title: 'Terms & Conditions - ATOM Game Shop',
      user: req.session.user || null,
      websiteUrl: process.env.WEBSITE_URL || 'http://localhost:3600'
    });
  },

  // POST /api/verify-user - Verify ML user ID and Zone ID
  verifyUser: async (req, res) => {
    const { userid, zoneid, gameCode } = req.body;

    console.log('🔍 Verify User Request:', { userid, zoneid, gameCode });

    if (!userid || !zoneid) {
      return res.status(400).json({
        status: 400,
        message: 'User ID and Server ID are required'
      });
    }

    try {
      // Determine Smile product ID and slug based on game code
      let smileProductId = '13'; // Default MLBB Global
      let productSlug = process.env.ML_API_PRODUCT || 'mobilelegends';
      let region = null;
      
      const code = String(gameCode || '').toLowerCase().trim();

      if (code === 'mcgg') {
        productSlug = 'magicchessgogo';
        smileProductId = '23825'; // Use default id for id check
      } else if (code === 'mlphp') {
        region = 'ph';
        smileProductId = '213'; // Use a valid PH product ID for verification (e.g., 5 Diamonds)
      }

      const smileTypeCode = code === 'mcgg' ? 'mcgg' : (code === 'mlphp' ? 'mlphp' : 'ml');
      if (!(await isProductTypeActiveForCustomer('smile', smileTypeCode))) {
        return res.status(404).json({
          status: 404,
          message: 'This game is not available at the moment.'
        });
      }

      console.log('🛠️ Using Smile Configuration:', { smileProductId, productSlug, code });

      const result = await smileOneGetRoleInfo({
        userid,
        zoneid,
        productid: smileProductId,
        productSlug,
        region
      });

      console.log('🔍 Smile One Verify Result:', JSON.stringify(result, null, 2));

      res.json(result);
    } catch (error) {
      console.error('ML API verification error:', error);
      res.status(500).json({
        status: 500,
        message: 'Server error while verifying user'
      });
    }
  },

  // POST /api/place-order - Process ML diamond order
  placeOrder: async (req, res) => {
    const { userid, zoneid, product_id, currency } = req.body;

    // Check if user is logged in
    if (!req.session.user) {
      return res.status(401).json({
        status: 401,
        message: 'Please login to place an order'
      });
    }

    const userId = req.session.user.id;

    // Acquire user lock to prevent concurrent orders from same user
    if (!acquireUserLock(userId)) {
      return res.status(429).json({
        status: 429,
        message: 'Another order is already being processed for your account. Please wait and try again.'
      });
    }

    // Log purchase attempt
    await logUserActivity(req.session.user.id, 'PURCHASE_ATTEMPT', {
      userEmail: req.session.user.email,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      productId: product_id,
      currency: currency,
      mlUserId: userid,
      mlZoneId: zoneid
    });

    if (!userid || !zoneid || !product_id || !currency) {
      // Release user lock on validation failure
      releaseUserLock(userId);
      
      // Log validation failure
      await logUserActivity(req.session.user.id, 'PURCHASE_VALIDATION_FAILED', {
        userEmail: req.session.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        missingFields: {
          userid: !userid,
          zoneid: !zoneid,
          product_id: !product_id,
          currency: !currency
        }
      });

      return res.status(400).json({
        status: 400,
        message: 'Missing required fields'
      });
    }

    const { sequelize } = require('../models');

    // Use database transaction with row-level locking to prevent race conditions
    const transaction = await sequelize.transaction();

    try {
      // Step 1: Get package info
      const product = await Product.findByPk(product_id);
      if (!product) {
        await transaction.rollback();
        releaseUserLock(userId);
        
        // Log product not found
        await logUserActivity(req.session.user.id, 'PURCHASE_PRODUCT_NOT_FOUND', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          productId: product_id
        });

        return res.status(404).json({
          status: 404,
          message: 'Package not found'
        });
      }

      // Determine product slug based on product type
      let productSlug = process.env.ML_API_PRODUCT || 'mobilelegends';
      let typeCodeForDb = 'ml'; // Default
      try {
        if (product.productTypeId) {
          const pType = await ProductType.findByPk(product.productTypeId);
          if (pType) {
            if (pType.status !== 'active') {
              await transaction.rollback();
              releaseUserLock(userId);
              return res.status(403).json({
                status: 403,
                message: 'This game is not available at the moment.'
              });
            }
             typeCodeForDb = pType.typeCode;
             if (pType.typeCode === 'mcgg') {
                productSlug = 'magicchessgogo';
             } else if (pType.typeCode === 'mlphp') {
                // mlphp uses the same slug but might need region handling elsewhere
                productSlug = 'mobilelegends'; 
             } else if (pType.typeCode === 'ml') {
                productSlug = 'mobilelegends';
             }
             // For g2bulk types (hok, pubgm, mlbb_special), productSlug might not be used in the same way 
             // but we ensure typeCodeForDb is correct for the transaction record.
          }
        }
      } catch (e) {
        console.warn('Failed to determine product slug from type:', e);
      }

      const packagePrice = currency === 'MMK' ? product.price_mmk : product.price_thb;

      // Step 2: Get wallet info with row-level locking to prevent race conditions
      const Wallet = require('../models/Wallet');
      const wallet = await Wallet.findOne({ 
        where: { userId: userId },
        lock: transaction.LOCK.UPDATE,
        transaction: transaction
      });
      
      if (!wallet) {
        await transaction.rollback();
        releaseUserLock(userId);
        
        // Log wallet not found
        await logUserActivity(req.session.user.id, 'PURCHASE_WALLET_NOT_FOUND', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          userId: userId
        });

        return res.status(404).json({
          status: 404,
          message: 'Wallet not found. Please contact support.'
        });
      }

      const userBalance = currency === 'MMK' ? wallet.balance_mmk : wallet.balance_thb;

      // Step 3: Check balance (now with locked wallet row)
      const balanceNum = Number(userBalance);
      const priceNum = Number(packagePrice);
      if (balanceNum < priceNum) {
        await transaction.rollback();
        releaseUserLock(userId);
        
        // Log insufficient balance
        await logUserActivity(req.session.user.id, 'PURCHASE_INSUFFICIENT_BALANCE', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          productId: product_id,
          productName: product.name,
          currency: currency,
          requiredAmount: priceNum,
          currentBalance: balanceNum,
          shortfall: priceNum - balanceNum
        });

        return res.status(400).json({
          status: 400,
          message: `Insufficient balance. Your ${currency} wallet has ${parseInt(userBalance)}. Required: ${parseInt(packagePrice)}`
        });
      }

      // Step 4: Load SmileOne product ID(s) from database mapping
      console.log(`[CombineDebug] Loading sub-items for product_id: ${product_id}`);
      let smileSubItems = await SmileSubItem.findAll({
        where: { productId: product_id, status: 'active' },
        order: [['sortOrder', 'ASC'], ['id', 'ASC']]
      });
      console.log(`[CombineDebug] Found ${smileSubItems.length} sub-items in DB.`);

      // Fallback to smileIDCombination if no sub-items found in DB
       if (!smileSubItems.length && product.smileIDCombination) {
           console.log(`[CombineDebug] No DB sub-items. Parsing smileIDCombination: ${product.smileIDCombination}`);
           const comboStr = String(product.smileIDCombination || '').trim();
           // Split by +, comma, or space (handling multiple separators)
           const ids = comboStr.split(/[\+,\s]+/).map(s => s.trim()).filter(Boolean);
           console.log(`[CombineDebug] Parsed IDs: ${JSON.stringify(ids)}`);
           
           if (ids.length > 0) {
              // Create temporary sub-items with equal weight
              smileSubItems = ids.map((id, idx) => ({
                  id: `temp_${idx}`,
                  productId: product_id,
                  smileProductId: id,
                  name: product.name + ` (Part ${idx+1})`,
                  amount: 1, // Equal weight for distribution
                  region: product.region || 'b',
                  status: 'active'
              }));
              console.log(`[CombineDebug] Created ${smileSubItems.length} temporary sub-items.`);
          }
      } else {
          console.log(`[CombineDebug] Skipping fallback. smileIDCombination: ${product.smileIDCombination}, subItems count: ${smileSubItems.length}`);
      }

      if (!smileSubItems.length) {
        console.error(`[CombineError] No sub-items found for product ${product_id}. smileIDCombination: ${product.smileIDCombination}`);
        await transaction.rollback();
        releaseUserLock(userId);

        await logUserActivity(req.session.user.id, 'PURCHASE_SMILE_MAPPING_MISSING', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          productId: product_id,
          productName: product.name
        });

        return res.status(400).json({
          status: 400,
          message: 'Smile product mapping is not configured for this package. Please contact support.'
        });
      }

      console.log('🎯 User Order Details:');
      console.log(`   👤 User: ${req.session.user.name} (ID: ${req.session.user.id})`);
      console.log(`   🛒 Product Chosen: ${product.name} (${product.diamond_amount} diamonds)`);
      console.log(`   💰 Amount: ${priceNum} ${currency}`);
      console.log(`   🎮 ML Account: ${userid}(${zoneid})`);
      console.log('🔗 Smile sub items from DB:');
      smileSubItems.forEach((s, index) => {
        console.log(`   ${index + 1}. ID=${s.id} smileProductId=${s.smileProductId} amount=${s.amount} region=${s.region}`);
      });

      // Step 5: Call SmileOne API to create order(s) using configured sub items
      // Calculate share for each sub item to support partial refunds
      const totalSubAmount = smileSubItems.reduce((acc, sub) => acc + Number(sub.amount), 0);
      
      const orders = [];
      let successfulAmount = 0;
      let refundedAmount = 0;
      const refundItems = [];
      const failureReasons = [];

      for (const sub of smileSubItems) {
        // Calculate the share of this sub item in the total package price
        const share = totalSubAmount > 0 
          ? (Number(sub.amount) / totalSubAmount) * priceNum 
          : (priceNum / smileSubItems.length);
        
        let orderRes = null;
        let success = false;
        let msg = '';

        try {
          orderRes = await smileOneCreateOrder({
            userid,
            zoneid,
            productid: sub.smileProductId,
            productSlug,
            region: sub.region || product.region // Pass region to API
          });
          
          if (orderRes && orderRes.status === 200) {
            success = true;
            successfulAmount += share;
          } else {
            msg = orderRes ? (orderRes.message || orderRes.msg || 'API Error') : 'No response';
          }
        } catch (e) {
          msg = e.message || 'Exception';
        }

        if (!success) {
          refundedAmount += share;
          refundItems.push({ 
            id: sub.id, 
            smileProductId: sub.smileProductId, 
            name: sub.name, 
            amount: share,
            reason: msg
          });
          failureReasons.push(`${sub.smileProductId}: ${msg}`);
          
          // Log individual failure
          await logUserActivity(req.session.user.id, 'PURCHASE_API_PARTIAL_FAIL', {
            userEmail: req.session.user.email,
            productId: product_id,
            packageId: sub.smileProductId,
            error: msg
          });
        }
        
        orders.push({ ...orderRes, success, smileSubItemId: sub.id });
      }

      // Determine final status
      const isFullSuccess = refundedAmount === 0;
      const isFullFailure = successfulAmount === 0;
      const status = isFullSuccess ? 'completed' : (isFullFailure ? 'fail' : 'partial_success');
      
      // Step 6: Deduct ONLY the successful amount from balance
      // If full failure, successfulAmount is 0, so no deduction.
      const newBalance = balanceNum - successfulAmount;
      const balanceField = currency === 'MMK' ? 'balance_mmk' : 'balance_thb';

      await wallet.update({
        [balanceField]: newBalance
      }, { transaction: transaction });

      // Step 7: Store purchase record within transaction
      const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
      const purchase = await GamePurchaseTransaction.create({
        user_id: userId,
        user_name: req.session.user.name,
        provider: 'smile',
        product_type_code: typeCodeForDb,
        product_id: String(product_id),
        product_name: product.name,
        player_id: userid,
        server_id: zoneid,
        quantity: 1,
        total_amount: successfulAmount, // Only charged amount
        currency: currency,
        status: status,
        order_id: orders.find(o => o.success)?.order_id || null,
        delivery_items: JSON.stringify({
          orders,
          smileSubItems: smileSubItems.map(s => ({
            id: s.id,
            productId: s.productId,
            smileProductId: s.smileProductId,
            amount: s.amount,
            region: s.region,
            status: s.status
          }))
        }),
        refunded_amount: refundedAmount,
        refund_items: JSON.stringify(refundItems),
        failure_reason: failureReasons.length ? failureReasons.join(' | ') : null
      }, { transaction: transaction });

      // Commit the transaction
      await transaction.commit();
      
      // Release user lock after successful transaction
      releaseUserLock(userId);

      if (isFullFailure) {
         return res.status(500).json({
            status: 500,
            message: 'Order processing failed. Please try again.',
            data: { purchaseId: purchase.id, failure_reason: purchase.failure_reason }
          });
      }

      // Step 8: Send confirmation email
      try {
        await sendOrderConfirmationEmail({
          user: req.session.user,
          product: product,
          purchase: purchase,
          userid: userid,
          zoneid: zoneid,
          amount: successfulAmount,
          currency: currency,
          newBalance: newBalance,
          orders: orders
        });

        // Log successful email notification
        await logUserActivity(req.session.user.id, 'PURCHASE_EMAIL_SENT', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          purchaseId: purchase.id,
          productName: product.name,
          amount: priceNum,
          currency: currency
        });
      } catch (emailError) {
        console.error('Email sending failed, but order was successful:', emailError);
        
        // Log email failure
        await logUserActivity(req.session.user.id, 'PURCHASE_EMAIL_FAILED', {
          userEmail: req.session.user.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          purchaseId: purchase.id,
          productName: product.name,
          emailError: emailError.message
        });
        // Continue execution - don't fail the order if email fails
      }

      // Log successful purchase completion
      await logUserActivity(req.session.user.id, 'PURCHASE_COMPLETED', {
        userEmail: req.session.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        purchaseId: purchase.id,
        productId: product_id,
        productName: product.name,
        category: product.category,
        mlUserId: userid,
        mlZoneId: zoneid,
        amount: priceNum,
        currency: currency,
        paymentMethod: 'wallet',
        mlOrderId: orders[0]?.order_id || null,
        newBalance: newBalance,
        packagesUsed: smileSubItems.length,
        totalDiamonds: product.diamond_amount
      });

      return res.status(200).json({
        status: 200,
        message: 'Order placed successfully! Check your email for confirmation.',
        data: {
          purchaseId: purchase.id,
          orders: orders,
          newBalance: newBalance,
          ml_order_id: orders[0]?.order_id || 'N/A'
        }
      });

    } catch (error) {
      console.error("Place Order Error:", error);
      
      // Rollback transaction on any error
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError);
      }
      
      // Release user lock on error
      releaseUserLock(userId);
      
      // Log purchase error
      await loggingService.logError(req.session.user.id, 'PURCHASE_ERROR', error, {
        userEmail: req.session.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        formData: { userid, zoneid, product_id, currency }
      });

      return res.status(500).json({
        status: 500,
        message: 'Something went wrong while placing the order. Please try again.'
      });
    }
  },

  g2bulkFields: async (req, res) => {
    try {
      const code = String(req.params.code || '').trim().toLowerCase();
      if (!code) {
        return res.status(400).json({ ok: false, error: 'code is required' });
      }
      if (!(await isProductTypeActiveForCustomer('g2bulk', code))) {
        return res.status(404).json({ ok: false, error: 'This game is not available at the moment.' });
      }
      const result = await g2bulkFetchFields(code);
      return res.json({ ok: true, fields: result.fields, notes: result.notes });
    } catch (error) {
      return res.status(502).json({ ok: false, error: 'Failed to fetch fields' });
    }
  },

  g2bulkCheckPlayer: async (req, res) => {
    try {
      const code = String(req.params.code || '').trim().toLowerCase();
      if (!code) {
        return res.status(400).json({ ok: false, error: 'code is required' });
      }
      if (!(await isProductTypeActiveForCustomer('g2bulk', code))) {
        return res.status(404).json({ ok: false, error: 'This game is not available at the moment.' });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const fields = body.fields && typeof body.fields === 'object' ? body.fields : body;
      
      console.log(`🔍 G2Bulk Check Player (${code}):`, JSON.stringify(fields));

      const { playerId, serverId } = g2bulkExtractPlayerFields(fields);
      if (!playerId) {
        console.warn(`⚠️ G2Bulk Check Player (${code}) - Missing Player ID`);
        return res.status(400).json({ ok: false, error: 'player_id is required' });
      }
      
      // Ensure we construct the payload exactly as G2Bulk expects
      const payload = { 
        game: code, // Pass the game code
        user_id: playerId, 
        server_id: serverId || '',
        ...fields // Keep other fields just in case, but user_id/server_id/game take precedence
      };
      
      // Map mlbb_special to mlbb for verification if needed
      const verificationGameCode = code; // Keep original code unless specifically remapped
      // if (code === 'mlbb_special') {
      //     payload.game = 'mlbb';
      // }
      
      const upstream = await g2bulkCheckPlayerId(verificationGameCode, payload);
      const raw = upstream?.raw || {};
      
      console.log(`✅ G2Bulk Check Player (${code}) Result:`, JSON.stringify(raw));

      const ok = g2bulkIsValidPlayerCheck(raw);
      if (!ok) {
        const error = g2bulkPlayerCheckMessage(raw) || 'Player not found';
        return res.json({ ok: false, data: raw, error });
      }
      return res.json({ ok: true, data: raw });
    } catch (error) {
      console.error(`❌ G2Bulk Check Player (${req.params.code}) Error:`, error);
      return res.status(502).json({ ok: false, error: 'Failed to verify player' });
    }
  },

  g2bulkPlaceOrder: async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const code = String(req.params.code || body.code || '').trim().toLowerCase();
    const productId = String(body.product_id || body.productId || '').trim();
    const currency = String(body.currency || 'MMK').trim().toUpperCase();
    const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
    const remark = body.remark ? String(body.remark).trim() : '';

    if (!req.session?.user) {
      return res.status(401).json({ status: 401, message: 'Please login to place an order' });
    }

    if (!code || !productId) {
      return res.status(400).json({ status: 400, message: 'Missing required fields' });
    }

    if (!['MMK', 'THB'].includes(currency)) {
      return res.status(400).json({ status: 400, message: 'Invalid currency' });
    }

    const { playerId, serverId } = g2bulkExtractPlayerFields(fields);
    if (!playerId) {
      return res.status(400).json({ status: 400, message: 'Player ID is required' });
    }

    if (!(await isProductTypeActiveForCustomer('g2bulk', code))) {
      return res.status(404).json({
        status: 404,
        message: 'This game is not available at the moment.'
      });
    }

    const userId = req.session.user.id;
    if (!acquireUserLock(userId)) {
      return res.status(429).json({
        status: 429,
        message: 'Another order is already being processed for your account. Please wait and try again.'
      });
    }

    const { sequelize } = require('../models');
    const transaction = await sequelize.transaction();

    try {
      const { usdToMmk, usdToThb } = await getActiveUsdRates();

      // Check for G2Bulk Item mapping (Fixed Price)
      const g2bulkItem = !isNaN(Number(productId)) ? await G2BulkItem.findOne({
        where: { productId: Number(productId), status: 'active' },
        include: [{ model: Product, required: true }]
      }) : null;

      let targetG2BulkId = productId;
      let fixedPriceProduct = null;

      if (g2bulkItem) {
        targetG2BulkId = g2bulkItem.g2bulkProductId;
        fixedPriceProduct = g2bulkItem.Product;
      }

      const client = getG2BulkClientOrThrow();

      const playerCheckPayload = { player_id: playerId, user_id: playerId, ...(serverId ? { server_id: serverId } : {}), ...fields };
      const playerCheck = await g2bulkCheckPlayerId(code, playerCheckPayload);
      const playerCheckRaw = playerCheck?.raw || {};
      if (!g2bulkIsValidPlayerCheck(playerCheckRaw)) {
        const message = g2bulkPlayerCheckMessage(playerCheckRaw) || 'Invalid player ID. Please check and try again.';
        await transaction.rollback();
        releaseUserLock(userId);
        return res.status(400).json({ status: 400, message });
      }

      const catalogueRes = await client.get(`/games/${encodeURIComponent(code)}/catalogue`);
      const data = catalogueRes?.data;
      const apiProducts = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items)
          ? data.items
          : (Array.isArray(data?.catalogues) ? data.catalogues : []));

      const item = (Array.isArray(apiProducts) ? apiProducts : []).find(p => String(p?.id ?? p?.code ?? p?.productId ?? '') === String(targetG2BulkId));
      if (!item) {
        await transaction.rollback();
        releaseUserLock(userId);
        return res.status(404).json({ status: 404, message: 'Package not found in G2Bulk catalogue' });
      }

      const unitPriceUsd = Number((item?.amount ?? item?.unit_price ?? item?.price) || 0);
      const baseMmk = unitPriceUsd * usdToMmk;
      const baseThb = unitPriceUsd * usdToThb;

      let sellMmk = baseMmk;
      let sellThb = 0;

      if (fixedPriceProduct) {
        sellMmk = Number(fixedPriceProduct.price_mmk);
        sellThb = Number(fixedPriceProduct.price_thb);
      } else {
        // Dynamic pricing
        sellMmk = baseMmk;
        if (usdToThb > 0) {
          const sellUsd = sellMmk / usdToMmk;
          sellThb = sellUsd * usdToThb;
        }
      }

      const totalAmount = currency === 'MMK'
        ? Math.max(0, Math.round(sellMmk * 100) / 100)
        : Math.max(0, Math.round(sellThb * 100) / 100);

      const Wallet = require('../models/Wallet');
      const wallet = await Wallet.findOne({
        where: { userId: userId },
        lock: transaction.LOCK.UPDATE,
        transaction: transaction
      });

      if (!wallet) {
        await transaction.rollback();
        releaseUserLock(userId);
        return res.status(404).json({ status: 404, message: 'Wallet not found. Please contact support.' });
      }

      const balanceField = currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
      const currentBalance = Number(wallet[balanceField] || 0);
      if (!Number.isFinite(currentBalance) || currentBalance < totalAmount) {
        await transaction.rollback();
        releaseUserLock(userId);
        return res.status(400).json({
          status: 400,
          message: `Insufficient balance. Your ${currency} wallet has ${parseInt(currentBalance)}. Required: ${parseInt(totalAmount)}`
        });
      }

      const incomingIdempotencyKey = String(body.idempotencyKey || '').trim();
      // Always generate a unique key for normal purchases so old completed orders
      // do not get reused as "already completed" on new buy attempts.
      let idempotencyKey = incomingIdempotencyKey || `g2bulk:${userId}:${code}:${productId}:${playerId}:${serverId || ''}:${currency}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
      
      // Allow up to 6 duplicate requests
      const recentDuplicates = await GamePurchaseTransaction.count({
        where: {
          user_id: userId,
          product_type_code: code,
          product_id: String(productId),
          player_id: playerId,
          // Check last 1 minute
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 60000)
          }
        }
      });

      if (recentDuplicates >= 6) {
        await transaction.rollback();
        releaseUserLock(userId);
        return res.status(429).json({ status: 429, message: 'Too many requests. Please wait a moment.' });
      }

      // Use timestamp in idempotency key to allow duplicates
      if (recentDuplicates > 0) {
        idempotencyKey = `${idempotencyKey}:${Date.now()}`;
      }

      const existing = await GamePurchaseTransaction.findOne({ where: { idempotency_key: idempotencyKey } }).catch(() => null);
      if (existing) {
        const j = existing.toJSON();
        if (['completed', 'success', 'partial_success'].includes(String(j.status))) {
          await transaction.rollback();
          releaseUserLock(userId);
          return res.status(200).json({ status: 200, message: 'Order already completed.', data: { purchaseId: j.id, order_id: j.order_id || null } });
        }
        if (String(j.status) === 'fail') {
          idempotencyKey = `${idempotencyKey}:${Date.now()}`;
        } else {
          // If pending, check if it's stale (older than 2 minutes)
          const isStale = (Date.now() - new Date(j.created_at).getTime()) > 120000;
          if (isStale) {
             idempotencyKey = `${idempotencyKey}:${Date.now()}`;
          } else {
             await transaction.rollback();
             releaseUserLock(userId);
             return res.status(409).json({ status: 409, message: 'Duplicate request. Please wait.', data: { purchaseId: j.id, order_id: j.order_id || null } });
          }
        }
      }

      const newBalance = currentBalance - totalAmount;
      await wallet.update({ [balanceField]: newBalance }, { transaction: transaction });

      const productName = String(item?.title ?? item?.name ?? item?.productName ?? item?.label ?? '').trim() || productId;
      const purchase = await GamePurchaseTransaction.create({
        user_id: userId,
        user_name: req.session.user.name,
        provider: 'g2bulk',
        product_type_code: code,
        product_id: String(productId),
        product_name: productName,
        player_id: playerId,
        server_id: serverId || null,
        quantity: 1,
        total_amount: totalAmount,
        currency: currency,
        status: 'pending',
        idempotency_key: idempotencyKey,
        failure_reason: null
      }, { transaction: transaction });

      const callbackBase = normalizeCallbackBaseUrl(req);
      const callback_url = callbackBase ? `${callbackBase}/api/g2bulk/order-callback` : undefined;
      const orderPayload = {
        catalogue_name: productName,
        player_id: playerId,
        order_id: String(purchase.id),
        ...(serverId ? { server_id: serverId } : {}),
        ...(remark ? { remark } : {}),
        ...(callback_url ? { callback_url } : {})
      };

      let orderRes = null;
      try {
        orderRes = await g2bulkCreateOrder(code, orderPayload);
      } catch (error) {
        const data = error?.response?.data;
        orderRes = { raw: data || { success: false, message: 'Order creation failed' } };
      }

      const od = orderRes?.raw || {};
      console.log('[G2Bulk] Order response for purchase', purchase.id, ':', JSON.stringify(od));
      if (!od || od.success !== true) {
        const failureReason = String(od?.message || od?.error || 'Order creation failed');
        await wallet.update({ [balanceField]: currentBalance }, { transaction: transaction });
        await purchase.update({
          status: 'fail',
          order_id: null,
          delivery_items: null,
          refunded_amount: totalAmount,
          failure_reason: failureReason,
          updated_at: new Date()
        }, { transaction: transaction });
        await transaction.commit();
        releaseUserLock(userId);
        try {
          const User = require('../models/User');
          const user = await User.findByPk(userId).catch(() => null);
          const walletAfter = Number(currentBalance || 0);
          await sendG2BulkStatusEmail({ user, tx: purchase, playerName: null, walletAfter });
        } catch (_) {}
        return res.status(502).json({ status: 502, message: failureReason });
      }

      const order = od.order && typeof od.order === 'object' ? od.order : {};
      const providerStatus = normalizeG2BulkStatus(order.status) || normalizeG2BulkStatus(od.status) || 'pending';
      const resolvedOrderId = order.order_id || od.order_id || order.orderId || od.orderId || String(purchase.id);
      console.log('[G2Bulk] Resolved status:', providerStatus, 'order_id:', resolvedOrderId, 'for purchase', purchase.id);
      await purchase.update({
        status: providerStatus,
        order_id: String(resolvedOrderId),
        delivery_items: null,
        updated_at: new Date()
      }, { transaction: transaction });

      await transaction.commit();
      releaseUserLock(userId);

      try {
        const User = require('../models/User');
        const user = await User.findByPk(userId).catch(() => null);
        const walletAfter = Number(newBalance || 0);
        await sendG2BulkStatusEmail({ user, tx: purchase, playerName: order.player_name ? String(order.player_name) : null, walletAfter });
      } catch (_) {}

      return res.status(200).json({
        status: 200,
        message: 'Order created. Status updates will be sent to your email.',
        data: { purchaseId: purchase.id, order_id: purchase.order_id || null, newBalance: newBalance, status: providerStatus }
      });
    } catch (error) {
      try { await transaction.rollback(); } catch (_) {}
      releaseUserLock(userId);
      const upstreamMessage = error?.response?.data?.message || error?.response?.data?.error;
      if (upstreamMessage) {
        return res.status(502).json({ status: 502, message: String(upstreamMessage) });
      }
      console.error('g2bulkPlaceOrder error:', error);
      return res.status(500).json({ status: 500, message: 'Something went wrong while placing the order. Please try again.' });
    }
  },

  g2bulkOrderCallback: async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderId = String(body.order_id || body.orderId || '').trim();
    const statusRaw = body.status;
    console.log('[G2Bulk Callback] Received:', JSON.stringify(body));
    if (!orderId) {
      return res.status(400).json({ ok: false, error: 'order_id is required' });
    }

    const normalized = normalizeG2BulkStatus(statusRaw);
    if (!normalized) {
      console.log('[G2Bulk Callback] Invalid status:', statusRaw, 'for order_id:', orderId);
      return res.status(400).json({ ok: false, error: 'invalid status' });
    }

    const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
    let tx = await GamePurchaseTransaction.findOne({ where: { provider: 'g2bulk', order_id: orderId } }).catch(() => null);
    if (!tx) {
      // Fallback: try matching by purchase id (we send purchase.id as order_id to G2Bulk)
      tx = await GamePurchaseTransaction.findByPk(orderId).catch(() => null);
      if (tx && tx.provider !== 'g2bulk') tx = null;
    }
    if (!tx) {
      console.log('[G2Bulk Callback] No transaction found for order_id:', orderId);
      return res.json({ ok: true });
    }
    console.log('[G2Bulk Callback] Found transaction:', tx.id, 'current status:', tx.status, '-> new status:', normalized);

    const { sequelize } = require('../models');
    const t = await sequelize.transaction();
    try {
      const fresh = await GamePurchaseTransaction.findByPk(tx.id, { transaction: t });
      if (!fresh) {
        await t.rollback();
        return res.json({ ok: true });
      }

      const currentStatus = String(fresh.status || '');
      if (currentStatus === 'completed' || currentStatus === 'fail') {
        await t.rollback();
        return res.json({ ok: true });
      }

      const User = require('../models/User');
      const Wallet = require('../models/Wallet');
      const user = await User.findByPk(fresh.user_id).catch(() => null);

      if (normalized === 'processing') {
        if (currentStatus !== 'processing') {
          fresh.status = 'processing';
          fresh.updated_at = new Date();
          await fresh.save({ transaction: t });
        }
        await t.commit();
        try {
          const walletRow = await Wallet.findOne({ where: { userId: fresh.user_id } }).catch(() => null);
          const walletAfter = walletRow ? Number((fresh.currency === 'MMK' ? walletRow.balance_mmk : walletRow.balance_thb) || 0) : 0;
          const playerName = body.player_name ? String(body.player_name) : '';
          await sendG2BulkStatusEmail({ user, tx: fresh, playerName, walletAfter });
        } catch (_) {}
        return res.json({ ok: true });
      }

      if (normalized === 'completed') {
        fresh.status = 'completed';
        fresh.transaction_id = body.transaction_id ? String(body.transaction_id) : fresh.transaction_id;
        try { fresh.delivery_items = JSON.stringify(body.delivery_items || body.items || null); } catch (_) { fresh.delivery_items = null; }
        fresh.failure_reason = null;
        fresh.updated_at = new Date();
        await fresh.save({ transaction: t });
        await t.commit();
        try {
          const walletRow = await Wallet.findOne({ where: { userId: fresh.user_id } }).catch(() => null);
          const walletAfter = walletRow ? Number((fresh.currency === 'MMK' ? walletRow.balance_mmk : walletRow.balance_thb) || 0) : 0;
          const playerName = body.player_name ? String(body.player_name) : '';
          await sendG2BulkStatusEmail({ user, tx: fresh, playerName, walletAfter });
        } catch (_) {}
        return res.json({ ok: true });
      }

      if (normalized === 'fail') {
        const Wallet = require('../models/Wallet');
        const wallet = await Wallet.findOne({
          where: { userId: fresh.user_id },
          lock: t.LOCK.UPDATE,
          transaction: t
        });

        const refund = Number(fresh.total_amount || 0);
        const balanceField = fresh.currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
        const prev = wallet ? Number(wallet[balanceField] || 0) : 0;
        const newBalance = wallet ? prev + refund : prev;
        if (wallet) {
          await wallet.update({ [balanceField]: newBalance }, { transaction: t });
        }

        fresh.status = 'fail';
        const reason = String(body.message || body.note || body.error || 'Order failed');
        fresh.failure_reason = reason;
        fresh.updated_at = new Date();
        await fresh.save({ transaction: t });

        await t.commit();
        try {
          const playerName = body.player_name ? String(body.player_name) : '';
          await sendG2BulkStatusEmail({ user, tx: fresh, playerName, walletAfter: newBalance });
        } catch (_) {}
        return res.json({ ok: true });
      }

      await t.commit();
      return res.json({ ok: true });
    } catch (_) {
      try { await t.rollback(); } catch (_) {}
      return res.status(500).json({ ok: false });
    }
  },

  // GET /api/user/purchases - Get user purchases (API endpoint)
  getUserPurchases: async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
      const purchases = await GamePurchaseTransaction.findAll({
        where: { user_id: req.session.user.id },
        order: [['created_at', 'DESC']]
      });

      const stats = {
        totalOrders: purchases.length,
        totalSpentMMK: 0,
        totalSpentTHB: 0
      };

      purchases.forEach(purchase => {
        if (!['completed', 'success', 'partial_success'].includes(purchase.status)) return;
        const amount = parseFloat(purchase.total_amount || 0);
        if (purchase.currency === 'MMK') stats.totalSpentMMK += amount;
        if (purchase.currency === 'THB') stats.totalSpentTHB += amount;
      });

      // Format purchases for frontend
      const formattedPurchases = purchases.map(purchase => ({
        id: purchase.id,
        product_name: purchase.product_name,
        category: null,
        ml_userid: purchase.player_id,
        ml_zoneid: purchase.server_id,
        amount: parseFloat(purchase.total_amount),
        currency: purchase.currency,
        status: purchase.status,
        date: new Date(purchase.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' }),
        ml_order_id: purchase.order_id
      }));

      res.json({
        success: true,
        purchases: formattedPurchases,
        stats: {
          totalOrders: stats.totalOrders,
          totalSpentMMK: stats.totalSpentMMK,
          totalSpentTHB: stats.totalSpentTHB
        }
      });
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      res.status(500).json({ error: 'Failed to fetch purchases' });
    }
  },

  // GET /api/user/transactions - Get user transactions (API endpoint)
  getUserTransactions: async (req, res) => {
    try {
      console.log('=== getUserTransactions API called ===');
      console.log('Session user:', req.session.user);
      console.log('Session exists:', !!req.session);

      if (!req.session.user) {
        console.log('❌ No user in session');
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log(`✅ User authenticated: ID ${req.session.user.id}, Name: ${req.session.user.name}, Email: ${req.session.user.email}`);

      const Transaction = require('../models/Transaction');

      // Get user transactions
      console.log(`🔍 Looking for transactions for user ID: ${req.session.user.id}`);
      const transactions = await Transaction.findByUserId(req.session.user.id);
      console.log(`📊 Found ${transactions.length} transactions`);

      // Calculate statistics
      const totalOrders = transactions.length;
      const totalSpent = transactions
        .filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      console.log(`📈 Stats - Total Orders: ${totalOrders}, Total Spent: ${totalSpent}`);

      // Format transactions for frontend
      const formattedTransactions = transactions.map(transaction => ({
        id: transaction.id,
        type: getTransactionType(transaction.payment_type),
        accountName: transaction.sender_account_name,
        accountNumber: transaction.sender_account_number,
        amount: parseFloat(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        date: new Date(transaction.created_at).toLocaleDateString(),
        screenshot: transaction.screenshot,
        reason: transaction.reason
      }));

      console.log('✅ Sending response with formatted transactions');
      res.json({
        success: true,
        transactions: formattedTransactions,
        stats: {
          totalOrders,
          totalSpent,
          currency: 'MMK' // You can make this dynamic based on user preference
        }
      });
    } catch (error) {
      console.error('❌ Error fetching user transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  },

  // Debug endpoint to check configuration
  debugConfig: (req, res) => {
    try {
      res.json({
        ML_API_URL: process.env.ML_API_URL,
        ML_API_EMAIL: process.env.ML_API_EMAIL,
        ML_API_UID: process.env.ML_API_UID,
        ML_API_PRODUCT: process.env.ML_API_PRODUCT,
        WEBSITE_URL: process.env.WEBSITE_URL,
        APP_URL: process.env.APP_URL,
        NODE_ENV: process.env.NODE_ENV,
        // Don't expose sensitive data
        ML_API_KEY: process.env.ML_API_KEY ? '***HIDDEN***' : 'NOT_SET'
      });
    } catch (error) {
      console.error('Error in debug config:', error);
      res.status(500).json({ error: 'Failed to get config' });
    }
  }
};

// Helper function to get transaction type display
function getTransactionType(paymentType) {
  const typeMap = {
    'KBZ Pay': '💳 KBZ Pay',
    'Wave Money': '🌊 Wave Money',
    'CB Pay': '🏦 CB Pay',
    'AYA Bank': '🏛️ AYA Bank',
    'KBZ Bank': '🏦 KBZ Bank',
    'CB Bank': '🏛️ CB Bank',
    'UAB Bank': '🏦 UAB Bank'
  };
  return typeMap[paymentType] || '💰 ' + paymentType;
}

function getGameNameFromTypeCode(typeCode) {
  const key = String(typeCode || '').trim().toLowerCase();
  const gameMap = {
    ml: 'Mobile Legends',
    mlphp: 'Mobile Legends (PH)',
    mlbb_special: 'Mobile Legends (SG/MY)',
    pubgm: 'PUBG Mobile',
    hok: 'Honor of Kings',
    mcgg: 'Magic Chess: Go Go'
  };
  return gameMap[key] || (typeCode ? String(typeCode).toUpperCase() : 'Unknown');
}

module.exports = mlController;
