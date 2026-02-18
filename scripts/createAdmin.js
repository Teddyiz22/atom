const { testConnection } = require('../config/database');
const User = require('../models/User');

const createAdmin = async () => {
  try {
    console.log('👑 Creating Admin User...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      where: {
        role: 'admin',
        email: 'admin@atomgameshop.com'
      }
    });

    if (existingAdmin) {
      console.log('👑 Admin user already exists');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Email Verified: ${existingAdmin.email_verified}`);
      return { success: true, message: 'Admin user already exists' };
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'ATOM Admin',
      email: 'admin@atomgameshop.com',
      password: 'admin123456', // Will be hashed by the beforeCreate hook
      phone_number: '+95912345678',
      role: 'admin',
      email_verified: true, // Admin doesn't need email verification
      status: 'active'
    });

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Name: ${adminUser.name}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Email Verified: ${adminUser.email_verified}`);
    console.log(`   Phone: ${adminUser.phone_number}`);
    console.log(`   Default Password: admin123456`);
    console.log('');
    console.log('🔐 IMPORTANT: Please change the default password after first login!');

    return { success: true, message: 'Admin user created successfully' };
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = createAdmin;

// If this script is run directly
if (require.main === module) {
  (async () => {
    try {
      console.log('🔗 Connecting to database...');
      const connected = await testConnection();
      if (!connected) {
        console.error('❌ Failed to connect to database');
        process.exit(1);
      }

      await createAdmin();
      console.log('✅ Admin creation completed!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Admin creation failed:', error);
      process.exit(1);
    }
  })();
} 