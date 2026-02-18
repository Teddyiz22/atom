# 📧 Quick Email Setup Guide - ATOM Game Shop

## Your Domain Email Configuration

You now have your own domain email: **admin@atomgameshop.com**

### 🔧 .env Configuration

Create or update your `.env` file with these settings:

```env
# Email Configuration - Domain Email (atomgameshop.com)
SMTP_HOST=mail.atomgameshop.com
SMTP_PORT=587
SMTP_USER=admin@atomgameshop.com
SMTP_PASS=Lukonehtan001!
SMTP_SECURE=false

# Alternative SMTP settings (try these if the above doesn't work)
# SMTP_HOST=smtp.atomgameshop.com
# SMTP_PORT=465
# SMTP_SECURE=true

# Website Configuration
WEBSITE_URL=https://atomgameshop.com

# Email Testing
TEST_EMAIL=admin@atomgameshop.com
```

### 🛠️ Common SMTP Settings for Domain Email

**Option 1: Standard SMTP (Recommended)**
```env
SMTP_HOST=mail.atomgameshop.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Option 2: Secure SMTP**
```env
SMTP_HOST=mail.atomgameshop.com
SMTP_PORT=465
SMTP_SECURE=true
```

**Option 3: Alternative Host**
```env
SMTP_HOST=smtp.atomgameshop.com
SMTP_PORT=587
SMTP_SECURE=false
```

### 🧪 Test Your Email Configuration

Run this command to test your email setup:
```bash
node scripts/testEmailService.js
```

### 🔍 Common Issues & Solutions

1. **Connection Refused:**
   - Try different SMTP_HOST: `smtp.atomgameshop.com` or `mail.atomgameshop.com`
   - Check if port 587 or 465 is open

2. **Authentication Failed:**
   - Verify email and password are correct
   - Check if SMTP authentication is enabled in iRedAdmin

3. **SSL/TLS Issues:**
   - Try SMTP_SECURE=false for port 587
   - Try SMTP_SECURE=true for port 465

### 📋 Step-by-Step Setup

1. **Create/Edit .env file:**
   ```bash
   nano .env
   ```

2. **Add the email configuration above**

3. **Restart your application:**
   ```bash
   npm restart
   ```

4. **Test the email service:**
   ```bash
   node scripts/testEmailService.js
   ```

5. **Test transaction emails:**
   - Go to Admin → Transactions
   - Approve/reject a transaction
   - Check if emails are sent successfully

### ✅ Verification

Your emails will now be sent from: **admin@atomgameshop.com**
Users will receive professional emails from your domain instead of Gmail! 