const session = require('express-session');
const MemoryStore = require('memorystore')(session);

// Session configuration with enhanced security
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000 // Prune expired entries every 24h
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevent XSS attacks via document.cookie
    maxAge: 24 * 60 * 60 * 1000, // 24 hours session timeout
    sameSite: 'lax' // Changed from 'strict' to 'lax' for OAuth compatibility
  },
  name: 'sessionId', // Don't use default session name
  rolling: true, // Reset expiration on activity
  genid: () => {
    // Generate cryptographically secure session IDs
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
};

// Middleware to track session activity and implement additional security
const sessionSecurityMiddleware = (req, res, next) => {
  // Track user agent and IP for session hijacking detection
  if (req.session) {
    const currentUserAgent = req.get('User-Agent');
    const currentIP = req.ip || req.connection.remoteAddress;
    
    // Initialize session security data
    if (!req.session.security) {
      req.session.security = {
        userAgent: currentUserAgent,
        ipAddress: currentIP,
        createdAt: new Date(),
        lastActivity: new Date()
      };
    } else {
      // Check for session hijacking attempts
      if (req.session.security.userAgent !== currentUserAgent) {
        console.warn('⚠️ Session hijacking attempt detected - User Agent mismatch:', {
          sessionId: req.sessionID,
          originalUA: req.session.security.userAgent,
          currentUA: currentUserAgent,
          userId: req.user ? req.user.id : 'anonymous'
        });
        
        // Destroy suspicious session
        req.session.destroy((err) => {
          if (err) console.error('Error destroying suspicious session:', err);
        });
        
        return res.status(401).json({ 
          error: 'Session security violation detected. Please log in again.' 
        });
      }
      
      // Update last activity
      req.session.security.lastActivity = new Date();
    }
    
    // Implement session timeout based on inactivity
    const inactivityTimeout = 2 * 60 * 60 * 1000; // 2 hours
    const lastActivity = new Date(req.session.security.lastActivity);
    const now = new Date();
    
    if (now - lastActivity > inactivityTimeout) {
      console.log('🕐 Session expired due to inactivity:', {
        sessionId: req.sessionID,
        lastActivity: lastActivity,
        userId: req.user ? req.user.id : 'anonymous'
      });
      
      req.session.destroy((err) => {
        if (err) console.error('Error destroying expired session:', err);
      });
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ 
          error: 'Session expired due to inactivity. Please log in again.' 
        });
      } else {
        return res.redirect('/users/login?expired=1');
      }
    }
  }
  
  next();
};

// Middleware to regenerate session ID on login for security
const regenerateSessionOnLogin = (req, res, next) => {
  if (req.user && req.session) {
    const oldSessionId = req.sessionID;
    
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
        return next(err);
      }
      
      console.log('🔄 Session regenerated on login:', {
        oldSessionId: oldSessionId,
        newSessionId: req.sessionID,
        userId: req.user.id
      });
      
      next();
    });
  } else {
    next();
  }
};

// Middleware to clear session data on logout
const clearSessionOnLogout = (req, res, next) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session on logout:', err);
        return next(err);
      }
      
      res.clearCookie('sessionId');
      console.log('🚪 Session cleared on logout');
      next();
    });
  } else {
    next();
  }
};

module.exports = {
  sessionConfig,
  sessionSecurityMiddleware,
  regenerateSessionOnLogin,
  clearSessionOnLogout
};