const { testConnection } = require('../config/database');
const createAdmin = require('./createAdmin');

const setupDatabase = async () => {
  try {
    console.log('🚀 Starting ATOM Game Shop Database Setup...');
    console.log('=====================================\n');

    // Test database connection first
    console.log('🔗 Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connection successful!\n');

    // Step 1: Create Admin User
    console.log('📝 Step 1: Creating Admin User');
    console.log('-------------------------------');
    const adminResult = await createAdmin();
    if (!adminResult.success) {
      throw new Error(`Admin creation failed: ${adminResult.error}`);
    }
    console.log('');

    // Step 2: Fix Screenshot Paths (remove duplicate /uploads/)
    console.log('📝 Step 2: Fixing Screenshot Paths');
    console.log('----------------------------------');
    try {
      const Transaction = require('../models/Transaction');
      const { Op } = require('sequelize');

      // Find transactions with /uploads/ prefix in screenshot path
      const transactionsToFix = await Transaction.findAll({
        where: {
          screenshot: {
            [Op.like]: '/uploads/%'
          }
        }
      });

      if (transactionsToFix.length > 0) {
        console.log(`🔧 Found ${transactionsToFix.length} transactions with duplicate uploads path`);

        // Fix each transaction
        for (const transaction of transactionsToFix) {
          const cleanPath = transaction.screenshot.replace('/uploads/', '');
          await transaction.update({ screenshot: cleanPath });
        }

        console.log(`✅ Fixed ${transactionsToFix.length} screenshot paths`);
      } else {
        console.log('✅ All screenshot paths are already correct');
      }
    } catch (error) {
      console.log('⚠️  Failed to fix screenshot paths:', error.message);
    }
    console.log('');

    // Setup complete
    console.log('🎉 ATOM Game Shop Database Setup Complete!');
    console.log('==========================================');
    console.log('✅ Admin user created');
    console.log('');
    console.log('📋 Quick Info:');
    console.log('   Admin Email: admin@atomgameshop.com');
    console.log('   Admin Password: admin123456');
    console.log('   🔐 Please change the admin password after first login!');
    console.log('');
    console.log('🚀 Your ATOM Game Shop is ready to go!');

    return { success: true, message: 'Database setup completed successfully' };
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = setupDatabase;

// If this script is run directly
if (require.main === module) {
  (async () => {
    try {
      await setupDatabase();
      process.exit(0);
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  })();
} 
