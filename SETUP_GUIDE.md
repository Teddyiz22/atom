# Database Setup Instructions

## 🗄️ Database Configuration with Sequelize ORM

You're absolutely right! With Sequelize ORM, we don't need manual SQL scripts. The ORM handles everything automatically.

## 📋 Setup Steps

### 1. Create .env file
Create a `.env` file in your project root with your database credentials:

```env
# Database Configuration
DB_HOST=194.163.40.98
DB_USER=nay_myo_htun
DB_PASSWORD=nay_myo_htun!@#
DB_NAME=nay_myo_htun_web
DB_PORT=3306

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Application Configuration
NODE_ENV=development
PORT=3000
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Application
```bash
npm run dev
```

## ✨ What Happens Automatically

When you start the server, Sequelize will:

1. ✅ Connect to your MySQL database
2. ✅ **Automatically create the 'users' table** based on the User model
3. ✅ Add all necessary columns, indexes, and constraints
4. ✅ Create demo users for testing

## 🏗️ Database Schema

The User model automatically creates this table structure:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  avatar VARCHAR(500),
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  role ENUM('user', 'admin') DEFAULT 'user',
  last_login TIMESTAMP NULL,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🔑 Demo Accounts

The system automatically creates these test accounts:

- **Admin**: admin@mldiamonds.com / password
- **User**: john@example.com / password  
- **User**: jane@example.com / password

## 🎯 Key Benefits of Using Sequelize

1. **No Manual SQL** - Tables created automatically from models
2. **Schema Migrations** - Easy database updates
3. **Data Validation** - Built-in validation rules
4. **Security** - Automatic SQL injection prevention
5. **Relationships** - Easy model associations
6. **Transactions** - Built-in transaction support

## 🚀 Ready to Go!

Just run `npm run dev` and your database will be set up automatically! 