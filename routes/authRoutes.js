const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/users/login?error=oauth_failed' }),
  async (req, res) => {
    try {
      console.log('✅ Google OAuth successful for:', req.user?.email);

      if (!req.user) {
        return res.redirect('/users/login?error=oauth_failed');
      }

      // Update last login (same as email/password login)
      try {
        await req.user.update({ last_login: new Date() });
      } catch (e) {
        console.error('Failed to update last_login after Google auth:', e.message);
      }

      const userPayload = typeof req.user.toJSON === 'function'
        ? req.user.toJSON()
        : {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            profilePicture: req.user.profilePicture,
            email_verified: req.user.email_verified,
            status: req.user.status
          };

      const redirectUrl = req.session.returnTo || '/shop';
      delete req.session.returnTo;
      const oldSessionId = req.sessionID;

      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regenerate error after Google auth:', err);
          // Fallback: still set user on current session
          req.session.user = userPayload;
          req.session.loginSuccess = true;
          req.session.successMessage = `Welcome, ${userPayload.name}! You have successfully signed in with Google.`;
          return res.redirect(redirectUrl);
        }

        console.log('🔄 Session regenerated on Google login:', {
          oldSessionId,
          newSessionId: req.sessionID,
          userId: userPayload.id
        });

        req.session.user = userPayload;
        req.session.loginSuccess = true;
        req.session.successMessage = `Welcome, ${userPayload.name}! You have successfully signed in with Google.`;
        return res.redirect(redirectUrl);
      });
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return res.redirect('/users/login?error=oauth_failed');
    }
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
