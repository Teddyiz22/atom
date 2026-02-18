# Database and Utility Scripts

This directory contains various scripts to help manage and maintain the ATOM Game Shop application.

## Scripts Available

### 1. Setup and Initial Data
- **`setupDatabase.js`** - Initialize database tables and relationships
- **`createAdmin.js`** - Create an admin user account
- **`seedProducts.js`** - Add initial ML diamond products to the database

### 2. Database Maintenance
- **`cleanupDatabase.js`** - ⚠️ **DANGEROUS** - Clean database while preserving admins and products
  - Removes all customer accounts, transactions, purchases, and wallets
  - Preserves admin users and products
  - Requires typing "YES" to confirm
  - Uses database transactions for safety

### 3. Testing and Debugging
- **`testEmailService.js`** - Test email service configuration and functionality
  - Checks email service setup and environment variables
  - Tests approval and rejection email sending
  - Set `TEST_EMAIL=your-email@domain.com` in .env for real email testing

## Usage

### Run any script:
```bash
node scripts/scriptName.js
```

### Examples:
```bash
# Test email service
node scripts/testEmailService.js

# Clean database (CAREFUL!)
node scripts/cleanupDatabase.js

# Create admin user
node scripts/createAdmin.js
```

## Environment Variables Required

Make sure your `.env` file contains:
```
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

# Email Service (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# For email testing
TEST_EMAIL=your-test-email@domain.com
```

## Development Workflow

1. **Initial Setup:**
   ```bash
   node scripts/setupDatabase.js
   node scripts/createAdmin.js
   node scripts/seedProducts.js
   ```

2. **Test Email Service:**
   ```bash
   node scripts/testEmailService.js
   ```

3. **Clean Database (Development Only):**
   ```bash
   node scripts/cleanupDatabase.js
   ```

⚠️ **WARNING**: Never run `cleanupDatabase.js` on production data!

## Available Scripts

### 🚀 setupDatabase.js
**Main setup script** - Run this to set up everything at once:
```bash
node scripts/setupDatabase.js
```

**What it does:**
- Creates an admin user (admin@atomgameshop.com / admin123456)
- Seeds all ML diamond products with updated amounts
- Clears any existing products first
- Sets up the complete database for the shop

### 👑 createAdmin.js
Creates an admin user without email verification:
```bash
node scripts/createAdmin.js
```

**Admin credentials:**
- Email: admin@atomgameshop.com
- Password: admin123456
- Role: admin
- Email verified: true (no verification needed)

### 💎 seedProducts.js
Seeds ML diamond products and passes:
```bash
node scripts/seedProducts.js
```

**Products included:**
- **Diamonds:** 86, 172, 275, 343, 429, 514, 600, 706, 878, 963, 1135, 1412, 2195, 3688, 5532, 9288
- **Weekly Pass:** Single product (6000 MMK / 180 THB)
- **Twilight Pass:** Single product (1000 MMK / 30 THB)
- **Double Diamonds:** 55, 165, 275, 565 (same as before)

### 🧹 cleanupDatabase.js
**⚠️ DANGER ZONE** - Cleans database while preserving admin users and products:
```bash
node scripts/cleanupDatabase.js
```

**What it removes:**
- All customer/regular user accounts
- All purchase records
- All transaction records  
- All wallet data
- Resets auto-increment counters

**What it preserves:**
- All admin users and their data
- All products in the catalog
- Database structure and relationships

**Safety features:**
- Requires typing "YES" to confirm
- Uses database transactions (rollback on error)
- Detailed logging of all operations
- Connection error handling

⚠️ **Use with extreme caution!** This is for development/testing purposes or when you need a fresh start while keeping your admin access and product catalog.

## Quick Start

1. Make sure your database is running and configured
2. Run the main setup script:
   ```bash
   node scripts/setupDatabase.js
   ```
3. Your ATOM Game Shop is ready to go!

## Development Workflow

### Fresh Start (keeping admin & products):
```bash
node scripts/cleanupDatabase.js
```

### Complete Reset:
```bash
node scripts/cleanupDatabase.js
node scripts/setupDatabase.js
```

## Security Notes

⚠️ **Important:** Change the default admin password after first login!

The admin user is created with `email_verified: true` so no email verification is required for admin access.

## Database Connection

All scripts automatically test the database connection before running. Make sure your database configuration in `config/database.js` is correct. 