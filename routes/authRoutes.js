const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/users/login?error=oauth_failed' }),
  (req, res) => {
    // Successful authentication
    console.log('✅ Google OAuth successful for:', req.user.email);

    // Store user in session (same as regular login)
    req.session.user = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profilePicture: req.user.profilePicture
    };

    // Redirect to dashboard or intended page
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;

    res.redirect(redirectUrl + '?login=success');
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('/?logout=success');
    });
  });
});

module.exports = router; 