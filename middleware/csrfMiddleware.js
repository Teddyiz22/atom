const csrf = require('csrf');
const { logUserActivity } = require('../services/loggingService');

// Create CSRF instance
const tokens = new csrf();

// Generate CSRF secret for session
const generateCSRFSecret = (req, res, next) => {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  next();
};

// Generate CSRF token for forms
const generateCSRFToken = (req, res, next) => {
  if (req.session.csrfSecret) {
    res.locals.csrfToken = tokens.create(req.session.csrfSecret);
  }
  next();
};

// Verify CSRF token for POST/PUT/DELETE requests
const verifyCSRFToken = async (req, res, next) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Skip CSRF for API endpoints that use other authentication
  if (req.path.startsWith('/api/') && req.path !== '/api/place-order') {
    return next();
  }

  const token = req.body._csrf || req.headers['x-csrf-token'];
  const secret = req.session.csrfSecret;

  if (!token || !secret) {
    // Log CSRF attack attempt
    if (req.session && req.session.user) {
      await logUserActivity(req.session.user.id, 'CSRF_TOKEN_MISSING', {
        userEmail: req.session.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        referer: req.get('Referer')
      });
    }

    return res.status(403).json({
      status: 403,
      message: 'CSRF token missing or invalid'
    });
  }

  if (!tokens.verify(secret, token)) {
    // Log CSRF attack attempt
    if (req.session && req.session.user) {
      await logUserActivity(req.session.user.id, 'CSRF_TOKEN_INVALID', {
        userEmail: req.session.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        referer: req.get('Referer'),
        providedToken: token
      });
    }

    return res.status(403).json({
      status: 403,
      message: 'CSRF token invalid'
    });
  }

  next();
};

// Middleware for forms that need CSRF protection
const protectForm = [generateCSRFSecret, generateCSRFToken, verifyCSRFToken];

// Middleware for API endpoints that need CSRF protection
const protectAPI = [generateCSRFSecret, verifyCSRFToken];

module.exports = {
  generateCSRFSecret,
  generateCSRFToken,
  verifyCSRFToken,
  protectForm,
  protectAPI
};