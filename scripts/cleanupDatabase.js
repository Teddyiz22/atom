const { Sequelize } = require('sequelize');
const path = require('path');

// Import models
const User = require('../models/User');
const Product = require('../models/Product');
const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');// Import database config
const { sequelize } = require('../config/database');

async function cleanupDatabase() {
  try {
    console.log('🧹 Starting database cleanup...');
    console.log('⚠️  This will remove ALL data except admin users and products!');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Start transaction for safe cleanup
    const transaction = await sequelize.transaction();

    try {
      // 1. Delete all Game Purchase Transactions
      console.log('🗑️  Cleaning up Game Purchase Transactions...');
      const deletedPurchases = await GamePurchaseTransaction.destroy({
        where: {},
        transaction
      });
      console.log(`   Deleted ${deletedPurchases} purchase records`);

      // 2. Delete all Transactions (this table references Users)
      console.log('🗑️  Cleaning up Transactions...');
      const deletedTransactions = await Transaction.destroy({
        where: {},
        transaction
      });
      console.log(`   Deleted ${deletedTransactions} transaction records`);

      // 3. Delete all Wallets (this table references Users)
      console.log('🗑️  Cleaning up Wallets...');
      const deletedWallets = await Wallet.destroy({
        where: {},
        transaction
      });
      console.log(`   Deleted ${deletedWallets} wallet records`);

      // 4. Delete all non-admin Users (keep admin users)
      console.log('🗑️  Cleaning up Users (keeping admin users)...');
      const deletedUsers = await User.destroy({
        where: {
          role: {
            [Sequelize.Op.ne]: 'admin' // Keep admin users
          }
        },
        transaction
      });
      console.log(`   Deleted ${deletedUsers} non-admin user records`);

      // 5. Get count of remaining records
      const remainingUsers = await User.count({
        where: { role: 'admin' },
        transaction
      });
      const remainingProducts = await Product.count({ transaction });

      console.log('\n📊 Cleanup Summary:');
      console.log(`   🔹 Purchases deleted: ${deletedPurchases}`);
      console.log(`   🔹 Transactions deleted: ${deletedTransactions}`);
      console.log(`   🔹 Wallets deleted: ${deletedWallets}`);
      console.log(`   🔹 Users deleted: ${deletedUsers}`);
      console.log(`   🔹 Admin users remaining: ${remainingUsers}`);
      console.log(`   🔹 Products remaining: ${remainingProducts}`);

      // Reset auto-increment counters for clean IDs
      console.log('\n🔄 Resetting auto-increment counters...');

      try {
        // Get actual table names from database
        const tables = await sequelize.query('SHOW TABLES', {
          type: Sequelize.QueryTypes.SELECT,
          transaction
        });

        // Find the correct table names (case-sensitive)
        const tableNames = tables.map(table => Object.values(table)[0]);

        // Reset counters for tables that exist and were cleaned
        const tablesToReset = ['game_purchase_transactions', 'transactions', 'wallets'];

        for (const tableName of tablesToReset) {
          // Find the actual table name (could be Purchases, purchases, etc.)
          const actualTableName = tableNames.find(name =>
            name.toLowerCase() === tableName.toLowerCase()
          );

          if (actualTableName) {
            await sequelize.query(
              `ALTER TABLE \`${actualTableName}\` AUTO_INCREMENT = 1`,
              { transaction }
            );
            console.log(`   ✅ Reset ${actualTableName} ID counter`);
          }
        }

        // For Users table, set counter to max existing ID + 1 (to preserve admin user IDs)
        const userTableName = tableNames.find(name =>
          name.toLowerCase() === 'users'
        );

        if (userTableName) {
          const maxUserId = await sequelize.query(
            `SELECT MAX(id) as maxId FROM \`${userTableName}\``,
            {
              type: Sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          if (maxUserId[0].maxId) {
            await sequelize.query(
              `ALTER TABLE \`${userTableName}\` AUTO_INCREMENT = ${maxUserId[0].maxId + 1}`,
              { transaction }
            );
            console.log(`   ✅ Reset ${userTableName} ID counter to ${maxUserId[0].maxId + 1}`);
          }
        }

      } catch (counterError) {
        console.log('   ⚠️  Auto-increment reset skipped (not critical):', counterError.message);
        // Don't fail the entire operation for this
      }

      // Commit the transaction
      await transaction.commit();

      console.log('\n✅ Database cleanup completed successfully!');
      console.log('\n🎯 What was preserved:');
      console.log('   • All admin users and their data');
      console.log('   • All products in the product catalog');
      console.log('   • Database structure and relationships');

      console.log('\n🗑️  What was cleaned:');
      console.log('   • All customer/regular user accounts');
      console.log('   • All purchase records');
      console.log('   • All transaction records');
      console.log('   • All wallet records');
      console.log('   • Auto-increment counters reset for fresh start');

      console.log('\n🔐 Admin users can continue to:');
      console.log('   • Access admin panel');
      console.log('   • Manage products');
      console.log('   • View empty reports (ready for new data)');

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Database cleanup failed:');
    console.error(error.message);

    if (error.name === 'SequelizeConnectionError') {
      console.error('\n💡 Please check:');
      console.error('   • Database server is running');
      console.error('   • Database credentials are correct');
      console.error('   • Database exists');
    }

    process.exit(1);
  } finally {
    // Close database connection
    await sequelize.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
}

// Add confirmation prompt
function askForConfirmation() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will permanently delete:');
    console.log('   • All customer accounts');
    console.log('   • All purchase history');
    console.log('   • All transaction records');
    console.log('   • All wallet data');
    console.log('\n✅ This will preserve:');
    console.log('   • Admin users');
    console.log('   • All products');
    console.log('   • Database structure');

    rl.question('\n❓ Are you sure you want to proceed? (type "YES" to confirm): ', (answer) => {
      rl.close();
      resolve(answer === 'YES');
    });
  });
}

// Main execution
async function main() {
  console.log('🧹 ATOM Game Shop - Database Cleanup Tool');
  console.log('==========================================');

  const confirmed = await askForConfirmation();

  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled. No changes made.');
    process.exit(0);
  }

  console.log('\n🚀 Proceeding with database cleanup...\n');
  await cleanupDatabase();
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { cleanupDatabase }; 
