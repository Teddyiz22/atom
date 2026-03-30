const { body, param, query, validationResult } = require('express-validator');
const { logUserActivity } = require('../services/loggingService');

// Validation rules for ML user verification
const validateMLUser = [
  body('userid')
    .isLength({ min: 6, max: 12 })
    .isNumeric()
    .withMessage('User ID must be 6-12 digits'),
  body('zoneid')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('Zone ID must be 4-6 digits')
];

// Validation rules for ML order placement
const validateMLOrder = [
  body('userid')
    .isLength({ min: 6, max: 12 })
    .isNumeric()
    .withMessage('User ID must be 6-12 digits'),
  body('zoneid')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('Zone ID must be 4-6 digits'),
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  body('currency')
    .isIn(['MMK', 'THB'])
    .withMessage('Currency must be MMK or THB')
];

const validateManualGameOrder = [
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  body('currency')
    .isIn(['MMK', 'THB'])
    .withMessage('Currency must be MMK or THB'),
  body('player_id')
    .trim()
    .isLength({ min: 3, max: 64 })
    .withMessage('Player ID must be 3–64 characters')
];

// Validation rules for contact form
const validateContact = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\s\u1000-\u109F]+$/)
    .withMessage('Name must be 2-100 characters and contain only letters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('subject')
    .isLength({ min: 5, max: 200 })
    .escape()
    .withMessage('Subject must be 5-200 characters'),
  body('message')
    .isLength({ min: 10, max: 1000 })
    .escape()
    .withMessage('Message must be 10-1000 characters')
];

// Validation rules for user profile updates
const validateProfileUpdate = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\s\u1000-\u109F]+$/)
    .withMessage('Name must be 2-100 characters and contain only letters'),
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]+$/)
    .isLength({ min: 8, max: 20 })
    .withMessage('Phone number must be 8-20 characters and contain only numbers, +, -, spaces, and parentheses')
];

// Validation rules for user registration
const validateUserRegistration = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\s\u1000-\u109F]+$/)
    .withMessage('Name must be 2-100 characters and contain only letters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be 8-128 characters with at least one lowercase, uppercase, and number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Validation rules for login
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

// Validation rules for password reset
const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Validation rules for new password
const validateNewPassword = [
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be 8-128 characters with at least one lowercase, uppercase, and number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Middleware to handle validation errors
const handleValidationErrors = async (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation failure for security monitoring
    if (req.session && req.session.user) {
      await logUserActivity(req.session.user.id, 'VALIDATION_FAILED', {
        userEmail: req.session.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        errors: errors.array(),
        body: req.body
      });
    }

    // Return validation errors
    return res.status(400).json({
      status: 400,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Sanitization middleware for additional security
const sanitizeInput = (req, res, next) => {
  // Remove any potential script tags or dangerous HTML
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    return value;
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        req.body[key] = sanitizeValue(req.body[key]);
      }
    }
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        req.query[key] = sanitizeValue(req.query[key]);
      }
    }
  }

  next();
};

module.exports = {
  validateMLUser,
  validateMLOrder,
  validateManualGameOrder,
  validateContact,
  validateProfileUpdate,
  validateUserRegistration,
  validateLogin,
  validatePasswordReset,
  validateNewPassword,
  handleValidationErrors,
  sanitizeInput
};