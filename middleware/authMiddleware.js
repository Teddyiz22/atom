// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    // Store the original URL for redirect after login
    req.session.returnTo = req.originalUrl;
    return res.redirect('/users/login?errorToast=Please login to access this page');
  }
};

// Check if user is authenticated (for API routes)
const requireAuthAPI = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
};

// Check if user is guest (not authenticated)
const requireGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/shop');
  } else {
    return next();
  }
};

module.exports = {
  requireAuth,
  requireAuthAPI,
  requireGuest
}; 