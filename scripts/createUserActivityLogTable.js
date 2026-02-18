const { sequelize } = require('../config/database');

async function checkDatabaseAndTable() {
    try {
        console.log('🔍 Checking database connection and table status...');
        
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection successful');
        
        // Check current database name
        const [dbResult] = await sequelize.query('SELECT DATABASE() as current_db');
        console.log('📊 Current database:', dbResult[0].current_db);
        
        // Check if user_activity_logs table exists
        const [tables] = await sequelize.query("SHOW TABLES LIKE 'user_activity_logs'");
        
        if (tables.length > 0) {
            console.log('✅ user_activity_logs table exists');
            
            // Show table structure
            const [structure] = await sequelize.query('DESCRIBE user_activity_logs');
            console.log('📋 Table structure:');
            structure.forEach(col => {
                console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
            });
            
            // Test logging functionality
            console.log('\n🧪 Testing user activity logging...');
            const { logUserActivity } = require('../services/loggingService');
            
            // Get a valid user ID
            const [users] = await sequelize.query('SELECT id, email FROM users LIMIT 1');
            if (users.length > 0) {
                const testUserId = users[0].id;
                console.log(`🧪 Testing with user ID: ${testUserId}`);
                
                await logUserActivity(testUserId, 'TEST_ACTIVITY', {
                    userEmail: users[0].email,
                    ipAddress: '127.0.0.1',
                    userAgent: 'Test User Agent'
                });
                
                console.log('✅ User activity logged successfully!');
            }
        } else {
            console.log('❌ user_activity_logs table does NOT exist');
            console.log('🔧 Creating the table...');
            
            // Create the table manually
            await sequelize.query(`
                CREATE TABLE user_activity_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    action_type VARCHAR(50) NOT NULL,
                    user_email VARCHAR(255) NULL,
                    ip_address VARCHAR(45) NULL,
                    user_agent TEXT NULL,
                    session_id VARCHAR(255) NULL,
                    metadata JSON NULL,
                    success BOOLEAN DEFAULT TRUE,
                    risk_level ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_action_type (action_type),
                    INDEX idx_created_at (created_at),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            console.log('✅ user_activity_logs table created successfully!');
            
            // Test logging after creation
            console.log('\n🧪 Testing user activity logging after table creation...');
            const { logUserActivity } = require('../services/loggingService');
            
            const [users] = await sequelize.query('SELECT id, email FROM users LIMIT 1');
            if (users.length > 0) {
                const testUserId = users[0].id;
                console.log(`🧪 Testing with user ID: ${testUserId}`);
                
                await logUserActivity(testUserId, 'TEST_ACTIVITY', {
                    userEmail: users[0].email,
                    ipAddress: '127.0.0.1',
                    userAgent: 'Test User Agent'
                });
                
                console.log('✅ User activity logged successfully!');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    } finally {
        await sequelize.close();
    }
}

checkDatabaseAndTable();