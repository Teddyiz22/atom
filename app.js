const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const passport = require('./config/passport');
require('dotenv').config();

// Import database configuration
const { testConnection, syncDatabase } = require('./config/database');
const { User, Product, Wallet, Transaction, UserActivityLog, ProductType, SmileSubItem, GamePurchaseTransaction } = require('./models');

// Set up model associations
User.hasOne(Wallet, { foreignKey: 'userId' });
Wallet.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

Product.hasMany(SmileSubItem, { foreignKey: 'productId' });
SmileSubItem.belongsTo(Product, { foreignKey: 'productId' });

User.hasMany(GamePurchaseTransaction, { foreignKey: 'user_id' });
GamePurchaseTransaction.belongsTo(User, { foreignKey: 'user_id' });

Product.hasMany(GamePurchaseTransaction, { foreignKey: 'product_id', sourceKey: 'id', constraints: false });
GamePurchaseTransaction.belongsTo(Product, { foreignKey: 'product_id', targetKey: 'id', constraints: false });

// UserActivityLog associations are handled in the models/index.js

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const mlRoutes = require('./routes/mlRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const languageRoutes = require('./routes/languageRoutes');
const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');

// Import services
const telegramService = require('./services/telegramService');

// Import language middleware
const { languageMiddleware } = require('./controllers/languageController');

// Import maintenance middleware
const { maintenanceMiddleware } = require('./middleware/maintenanceMiddleware');

// Import CSRF protection
const { generateCSRFSecret, generateCSRFToken } = require('./middleware/csrfMiddleware');

// Import enhanced session middleware
const { sessionConfig, sessionSecurityMiddleware } = require('./middleware/sessionMiddleware');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', false);

// Security middleware - must be early in the middleware stack
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://code.jquery.com", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://apis.google.com", "https://accounts.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://accounts.google.com", "https://www.googleapis.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://accounts.google.com"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional XSS protection
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.body._method) {
    console.log(`🔄 Method override: ${req.body._method}`);
  }
  next();
});

// Enhanced session configuration with security features
app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Session security middleware - must be after passport
app.use(sessionSecurityMiddleware);

// Language middleware (must be after session)
app.use(languageMiddleware);

// User middleware - make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// CSRF protection (must be after session)
app.use(generateCSRFSecret);
app.use(generateCSRFToken);

// Maintenance mode middleware (must be after session)
app.use(maintenanceMiddleware);

// Routes
app.use('/', mlRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/wallet', walletRoutes);
app.use('/blogs', blogRoutes);
app.use('/language', languageRoutes);
app.use('/auth', authRoutes);

// 404 Error handler
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    user: req.session?.user || null,
    layout: false
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', {
    title: 'Server Error',
    message: 'Something went wrong on our end.',
    user: req.session?.user || null,
    layout: false
  });
});

// Import setup script
const setupDatabase = require('./scripts/setupDatabase');

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔗 Connecting to database...');
    console.log('📋 Database config:');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   User: ${process.env.DB_USER}`);

    // Test database connection with retry logic
    let connected = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!connected && retryCount < maxRetries) {
      console.log(`🔄 Database connection attempt ${retryCount + 1}/${maxRetries}...`);
      connected = await testConnection();

      if (!connected) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    if (!connected) {
      console.error('❌ Failed to connect to database after multiple attempts.');
      console.error('⚠️  Starting server without database connection...');
      console.error('   The app will run but database features will be limited.');

      // Don't exit, just start the server without database
      app.listen(PORT, () => {
        console.log('');
        console.log('⚠️  Server is running on http://localhost:' + PORT);
        console.log('❌ Database connection failed - some features may not work');
        console.log('');
      });
      return;
    }

    // Sync database models (this will create tables automatically)
    console.log('🔄 Syncing database models...');
    const dbAlterRaw = process.env.DB_ALTER;
    const shouldAlter = dbAlterRaw === undefined || dbAlterRaw === 'true' || dbAlterRaw === '1';
    await syncDatabase(shouldAlter ? { alter: { drop: false } } : {});

    // Setup database (create admin & seed products)
    // await setupDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 Server is running on http://localhost:' + PORT);
      console.log('💎 ML Diamonds Store API is ready!');
      console.log('');
      console.log('📱 Available endpoints:');
      console.log('   - GET  /                    (Home page)');
      console.log('   - GET  /users/login         (Login page)');
      console.log('   - GET  /users/register      (Register page)');
      console.log('   - GET  /users/forgot-password (Forgot password)');
      console.log('   - GET  /users/profile       (User profile)');
      console.log('   - GET  /contact             (Contact page)');
      console.log('   - GET  /faq                 (FAQ page)');
      console.log('   - GET  /wallet              (Wallet page)');
      console.log('');
      console.log('🔑 Admin Login Credentials:');
      console.log('   Admin: admin@atomgameshop.com / admin123456');
      console.log('   🔐 Please change the admin password after first login!');
      console.log('');
      console.log('🐛 Debug Mode: Registration/Login attempts will show detailed logs');
      console.log('');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error details:', error.message);

    // Try to start server anyway
    console.log('⚠️  Attempting to start server without full initialization...');
    app.listen(PORT, () => {
      console.log('⚠️  Server is running on http://localhost:' + PORT);
      console.log('❌ Some features may not work due to initialization errors');
    });
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  const { closeConnection } = require('./config/database');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  const { closeConnection } = require('./config/database');
  await closeConnection();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
