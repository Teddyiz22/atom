const { sequelize } = require('../config/database');

async function removeAccountNumberColumn() {
  try {
    console.log('🔄 Starting migration: Removing sender_account_number column...');

    // Remove the sender_account_number column from transactions table
    await sequelize.query(`
      ALTER TABLE transactions 
      DROP COLUMN sender_account_number
    `);

    console.log('✅ Successfully removed sender_account_number column from transactions table');

    // Verify the column was removed
    const [results] = await sequelize.query(`
      DESCRIBE transactions
    `);

    const columns = results.map(row => row.Field);
    console.log('📋 Current columns in transactions table:', columns);

    if (!columns.includes('sender_account_number')) {
      console.log('✅ Verification successful: sender_account_number column no longer exists');
    } else {
      console.log('❌ Warning: sender_account_number column still exists');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    // Check if column doesn't exist (which is fine)
    if (error.message.includes("doesn't exist") || error.message.includes("Unknown column")) {
      console.log('ℹ️  Column already removed or doesn\'t exist - this is fine');
    } else {
      throw error;
    }
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  removeAccountNumberColumn()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = removeAccountNumberColumn; 