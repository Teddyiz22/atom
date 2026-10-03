const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireGuest } = require('../middleware/authMiddleware');

// Middleware to disable layout for user routes (they have their own HTML structure)
const disableLayout = (req, res, next) => {
  res.locals.layout = false;
  next();
};

// Apply to all user routes
router.use(disableLayout);

// User routes
router.get('/login', requireGuest, userController.showLogin);
router.post('/login', requireGuest, userController.login);
router.get('/register', requireGuest, userController.showRegister);
router.post('/register', requireGuest, userController.register);
router.post('/logout', userController.logout);

// Email verification routes
router.get('/verification-pending', userController.showVerificationPending);
router.get('/verify-email/:token', userController.verifyEmail);
router.post('/resend-verification', userController.resendVerificationEmail);

// Profile management routes
router.post('/update-profile', requireAuth, userController.updateProfile);
router.post('/change-password', requireAuth, userController.changePassword);

router.get('/forgot-password', requireGuest, userController.showForgotPassword);

// Forgot password routes
router.post('/forgot-password', requireGuest, userController.forgotPassword);

// Reset password routes
router.get('/reset-password/:token', requireGuest, userController.showResetPassword);
router.post('/reset-password/:token', requireGuest, userController.resetPassword);

module.exports = router; 