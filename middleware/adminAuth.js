// Admin Authentication Middleware
const adminAuth = (req, res, next) => {
  // Check if user is logged in
  if (!req.session.user) {
    req.session.errorMessage = 'Please login to access the admin panel.';
    return res.redirect('/users/login');
  }

  // Check if user has admin role
  if (req.session.user.role !== 'admin') {
    req.session.errorMessage = 'Access denied. Admin privileges required.';
    return res.redirect('/');
  }

  // User is authenticated and is admin
  next();
};

// API-friendly admin authentication (returns JSON for AJAX requests)
const adminApiAuth = (req, res, next) => {
  // Check if user is logged in
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Please login to access the admin panel.'
    });
  }

  // Check if user has admin role
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  // User is authenticated and is admin
  next();
};

module.exports = { adminAuth, adminApiAuth }; 