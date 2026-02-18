const { Sequelize } = require('sequelize');
require('dotenv').config();

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME || 'nay_myo_htun_web',
  process.env.DB_USER || 'remote_user',
  process.env.DB_PASSWORD || 'Lukonehtan001!',
  {
    host: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 20000, // 20 seconds
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '+00:00', // UTC timezone
    retry: {
      max: 3
    }
  }
);

// Test database connection with better error handling
const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    console.log(`📊 Connecting to: ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);

    await sequelize.authenticate();
    console.log('✅ Database connected successfully with Sequelize!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('❌ Failed to connect to database. Please check:');
    console.error('   1. Database server is running');
    console.error('   2. Database credentials are correct');
    console.error('   3. Database exists');
    console.error('   4. User has proper permissions');

    // Don't throw the error, just return false to prevent app crash
    return false;
  }
};

// Sync all models with database
const syncDatabase = async (options = {}) => {
  try {
    console.log('🔄 Syncing database models...');
    await sequelize.sync(options);
    try {
      const qi = sequelize.getQueryInterface();
      const table = await qi.describeTable('products');
      const colType = String(table?.diamond_amount?.type || '').toLowerCase();
      if (colType.includes('int')) {
        await sequelize.query('ALTER TABLE products MODIFY diamond_amount DECIMAL(12,2) NOT NULL DEFAULT 0');
      }
    } catch (e) {
      console.error('❌ Post-sync schema patch failed:', e.message);
    }
    console.log('✅ Database models synced successfully!');
    return true;
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
    return false;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('📴 Database connection closed.');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
  Sequelize
}; 
