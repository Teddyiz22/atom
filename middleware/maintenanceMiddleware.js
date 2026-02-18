const fs = require('fs').promises;
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, '../config/maintenance.json');

// Get maintenance mode status
async function getMaintenanceStatus() {
  try {
    const data = await fs.readFile(MAINTENANCE_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.enabled || false;
  } catch (error) {
    // If file doesn't exist, maintenance mode is off
    return false;
  }
}

// Set maintenance mode status
async function setMaintenanceStatus(enabled) {
  try {
    const config = {
      enabled: !!enabled,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(MAINTENANCE_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error updating maintenance status:', error);
    return false;
  }
}

// Middleware to check maintenance mode
async function maintenanceMiddleware(req, res, next) {
  try {
    const isMaintenanceActive = await getMaintenanceStatus();

    // If maintenance is not active, continue normally
    if (!isMaintenanceActive) {
      return next();
    }

    // Allow admin users to bypass maintenance
    if (req.session && req.session.user && req.session.user.role === 'admin') {
      return next();
    }

    // Allow access to admin routes for login
    if (req.path.startsWith('/admin') || req.path.startsWith('/users/login')) {
      return next();
    }

    // Show maintenance page for everyone else
    return res.status(503).render('maintenance', {
      title: 'Under Maintenance - ATOM Game Shop',
      layout: false // Don't use layout for maintenance page
    });
  } catch (error) {
    console.error('Maintenance middleware error:', error);
    return next(); // Continue on error
  }
}

module.exports = {
  maintenanceMiddleware,
  getMaintenanceStatus,
  setMaintenanceStatus
}; 