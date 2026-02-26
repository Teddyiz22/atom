const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const mlController = require('../controllers/mlController');
const { requireAuth, requireAuthAPI } = require('../middleware/authMiddleware');
const {
  validateMLUser,
  validateMLOrder,
  validateContact,
  handleValidationErrors,
  sanitizeInput
} = require('../middleware/validationMiddleware');
const { protectAPI, protectForm, generateCSRFSecret, generateCSRFToken } = require('../middleware/csrfMiddleware');

// Rate limiting for purchase endpoint to prevent abuse
const purchaseRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 3, // Reduced from 5 to 3 purchase attempts per minute for better security
  message: {
    status: 429,
    message: 'Too many purchase attempts. Please wait before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Enhanced key generator for user-specific rate limiting
  keyGenerator: (req) => {
    // If user is logged in, use user ID for more precise rate limiting
    if (req.session?.user?.id) {
      return `user:${req.session.user.id}`;
    }
    // Fallback to IP-based rate limiting for non-authenticated requests
    return ipKeyGenerator(req);
  },
  skip: (req) => {
    // Skip rate limiting for admin users (optional)
    return req.session?.user?.role === 'admin';
  },
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    console.log(`Rate limit exceeded for ${req.session?.user?.email || req.ip} on purchase endpoint`);
    res.status(429).json({
      status: 429,
      message: 'Too many purchase attempts. Please wait 1 minute before trying again.',
      retryAfter: 60
    });
  }
});

// Rate limiting for user verification to prevent API abuse
const verificationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Limit each IP to 10 verification attempts per minute
  message: {
    status: 429,
    message: 'Too many verification attempts. Please wait before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply sanitization middleware to all routes
router.use(sanitizeInput);

// Middleware to disable layout for ML routes (they have their own HTML structure)
const disableLayout = (req, res, next) => {
  res.locals.layout = false;
  next();
};

// Middleware to set current path for navigation highlighting
const setCurrentPath = (req, res, next) => {
  res.locals.currentPath = req.path;
  next();
};

// Apply to all ML routes
router.use(disableLayout);
router.use(setCurrentPath);

// Public routes
router.get('/', mlController.shopTypes);
router.get('/about', mlController.about);
router.get('/contact', mlController.contact);
router.post('/contact', validateContact, handleValidationErrors, protectForm, mlController.submitContact);
router.get('/guide', mlController.guide);
router.get('/disclaimer', mlController.disclaimer);
router.get('/privacy-policy', mlController.privacyPolicy);
router.get('/terms-and-conditions', mlController.termsAndConditions);

// Shop routes
router.get('/shop', mlController.shopTypes);
router.get('/shop/hok', generateCSRFSecret, generateCSRFToken, (req, res, next) => {
  req.params.typeCode = 'hok';
  req.query.provider = 'g2bulk';
  next();
}, mlController.shop);
router.get('/shop/mcgg', generateCSRFSecret, generateCSRFToken, (req, res, next) => {
  req.params.typeCode = 'mcgg';
  req.query.provider = 'smile';
  next();
}, mlController.shop);
router.get('/shop/mlbb_special', generateCSRFSecret, generateCSRFToken, (req, res, next) => {
  req.params.typeCode = 'mlbb_special';
  req.query.provider = 'g2bulk';
  next();
}, mlController.shop);
router.get('/shop/ml', generateCSRFSecret, generateCSRFToken, (req, res, next) => {
  req.params.typeCode = 'ml';
  req.query.provider = 'smile';
  next();
}, mlController.shop);
router.get('/shop/mlphp', generateCSRFSecret, generateCSRFToken, (req, res, next) => {
  req.params.typeCode = 'mlphp';
  req.query.provider = 'smile';
  next();
}, mlController.shop);
router.get('/shop/pubgm', generateCSRFSecret, generateCSRFToken, (req, res, next) => {
  req.params.typeCode = 'pubgm';
  req.query.provider = 'g2bulk';
  next();
}, mlController.shop);
router.get('/shop/:typeCode', generateCSRFSecret, generateCSRFToken, mlController.shop);
router.post('/shop/order', requireAuth, mlController.processOrder);

// API Routes with validation
router.get('/api/debug-config', mlController.debugConfig);
router.post('/api/verify-user', verificationRateLimit, validateMLUser, handleValidationErrors, mlController.verifyUser);
router.post('/api/place-order', purchaseRateLimit, requireAuthAPI, validateMLOrder, handleValidationErrors, protectAPI, mlController.placeOrder);
router.get('/api/g2bulk/games/:code/fields', mlController.g2bulkFields);
router.post('/api/g2bulk/games/:code/check-player', verificationRateLimit, mlController.g2bulkCheckPlayer);
router.post('/api/g2bulk/games/:code/order', purchaseRateLimit, requireAuthAPI, protectAPI, mlController.g2bulkPlaceOrder);
router.post('/api/g2bulk/order-callback', mlController.g2bulkOrderCallback);
router.get('/api/user/purchases', requireAuthAPI, mlController.getUserPurchases);
router.get('/api/user/transactions', requireAuthAPI, mlController.getUserTransactions);

// Test route (temporary)
router.get('/test-api', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, '../test-api.html'));
});

// Maintenance preview route (for testing)
router.get('/maintenance-preview', (req, res) => {
  res.render('maintenance', {
    title: 'Maintenance Preview - ATOM Game Shop',
    layout: false
  });
});

// Protected routes (require authentication)
router.get('/profile', requireAuth, mlController.profile);
router.get('/wallet', requireAuth, mlController.wallet);

// Order page routes (legacy)
router.get('/order', mlController.order);
router.post('/order', mlController.processOrder);
router.get('/orderhistory', mlController.orderhistory);

module.exports = router;
