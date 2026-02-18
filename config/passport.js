const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');
require('dotenv').config();

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 Google OAuth callback received for:', profile.emails[0].value);

    // Check if user already exists with this Google ID
    let user = await User.findOne({ where: { googleId: profile.id } });

    if (user) {
      console.log('✅ Existing Google user found:', user.email);

      // Check account status for existing Google users
      if (user.status !== 'active') {
        if (user.status === 'inactive') {
          return done(null, false, { message: 'Your account has been disabled. Please contact our support team for assistance.' });
        } else if (user.status === 'suspended') {
          return done(null, false, { message: 'Your account has been suspended due to policy violations. Please contact support for assistance.' });
        } else {
          return done(null, false, { message: 'Your account is currently not active. Please contact support for assistance.' });
        }
      }

      return done(null, user);
    }

    // Check if user exists with this email (from regular registration)
    user = await User.findOne({ where: { email: profile.emails[0].value } });

    if (user) {
      // Check account status before linking
      if (user.status !== 'active') {
        if (user.status === 'inactive') {
          return done(null, false, { message: 'Your account has been disabled. Please contact our support team for assistance.' });
        } else if (user.status === 'suspended') {
          return done(null, false, { message: 'Your account has been suspended due to policy violations. Please contact support for assistance.' });
        } else {
          return done(null, false, { message: 'Your account is currently not active. Please contact support for assistance.' });
        }
      }

      // Link the existing account with Google
      user.googleId = profile.id;
      user.email_verified = true; // Auto-verify Google users
      if (profile.photos[0]?.value) {
        user.profilePicture = profile.photos[0].value;
      }
      await user.save();
      console.log('🔗 Linked existing account with Google:', user.email);
      return done(null, user);
    }

    // Create new user with Google account
    user = await User.create({
      email: profile.emails[0].value,
      name: profile.displayName,
      googleId: profile.id,
      email_verified: true, // Auto-verify Google users
      profilePicture: profile.photos[0]?.value || null,
      // No password needed for Google users
      password: null
    });

    console.log('✅ New Google user created:', user.email);

    // Create wallet for new user only
    const Wallet = require('../models/Wallet');

    // Check if wallet already exists (shouldn't happen for new users, but safety check)
    const existingWallet = await Wallet.findOne({ where: { userId: user.id } });
    if (!existingWallet) {
      await Wallet.create({
        userId: user.id,
        balance_mmk: 0,
        balance_thb: 0
      });
      console.log('💰 Wallet created for new user');
    } else {
      console.log('💰 Wallet already exists for user');
    }

    // Send welcome email
    try {
      const emailService = require('../services/emailService');
      await emailService.sendWelcomeEmail(user.email, user.name);
      console.log('📧 Welcome email sent to:', user.email);
    } catch (emailError) {
      console.log('⚠️ Failed to send welcome email:', emailError.message);
    }

    return done(null, user);
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    return done(error, null);
  }
}));

// Local Strategy (for regular email/password login)
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    // Check if user uses Google OAuth (no password)
    if (!user.password) {
      return done(null, false, { message: 'Please sign in with Google' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    // Check account status
    if (user.status !== 'active') {
      if (user.status === 'inactive') {
        return done(null, false, { message: 'Your account has been disabled. Please contact our support team for assistance.' });
      } else if (user.status === 'suspended') {
        return done(null, false, { message: 'Your account has been suspended due to policy violations. Please contact support for assistance.' });
      } else {
        return done(null, false, { message: 'Your account is currently not active. Please contact support for assistance.' });
      }
    }

    if (!user.email_verified) {
      return done(null, false, { message: 'Please verify your email before logging in' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

module.exports = passport; 