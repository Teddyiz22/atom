# 🤖 Telegram Bot Setup Guide

This guide will help you set up the Telegram bot for wallet top-up notifications and admin approvals.

## 📋 Prerequisites

✅ You already have a Telegram bot created with token: `8100112493:AAGh7XK2s9qFylQY1eXSt7jPRX0c4Td_VSY`

## 🔧 Step 1: Add Environment Variables

Add these environment variables to your `.env` file:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=8100112493:AAGh7XK2s9qFylQY1eXSt7jPRX0c4Td_VSY
TELEGRAM_ADMIN_CHAT_ID=

# Application URL (for screenshots)
APP_URL=http://localhost:3000

# Email Configuration (if not already set)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🆔 Step 2: Get Your Admin Chat ID

1. **Start the bot**: Send `/start` to your bot in Telegram
2. **Get your Chat ID**: The bot will show your chat ID
3. **Add Chat ID**: Copy the chat ID and add it to your `.env` file

```env
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
```

## 🚀 Step 3: Restart Your Server

After adding the environment variables, restart your Node.js server:

```bash
# If using PM2
pm2 restart nmh-shop

# If running directly
npm start
```

## 🧪 Step 4: Test the Bot

1. **Send `/start`** to your bot in Telegram
2. **Send `/status`** to check if everything is working
3. **Submit a test top-up** request from your website

## 🎯 How It Works

### For Users:
1. User submits a wallet top-up request with payment screenshot
2. User receives confirmation message
3. User gets email notification when approved/rejected

### For Admins:
1. **Instant Notification**: Receive immediate Telegram message with:
   - User details (name, email, ID)
   - Transaction details (amount, payment method, account info)
   - Payment screenshot
   - Approve/Reject buttons

2. **Quick Actions**: Use inline buttons to:
   - ✅ **Approve**: Instantly adds money to user wallet + sends email
   - ❌ **Reject**: Choose rejection reason + sends email to user

### Email Integration:
- **Approval Email**: Beautiful email with transaction details and wallet balance
- **Rejection Email**: Clear email with rejection reason and next steps

## 🔧 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and your chat ID |
| `/help` | Show detailed help information |
| `/status` | Check bot status and configuration |

## 📱 Features

### Instant Notifications
- Real-time alerts when users submit top-up requests
- Complete user and transaction details
- Payment screenshot preview

### One-Click Actions
- Approve transactions with single button press
- Reject with predefined reasons
- Automatic wallet balance updates
- Automatic email notifications

### Professional Emails
- Beautiful HTML email templates
- Clear transaction details
- Direct links to wallet and shop
- Mobile-friendly design

## 🛠️ Troubleshooting

### Bot Not Responding
- Check if `TELEGRAM_BOT_TOKEN` is correct in `.env`
- Restart your server after adding environment variables
- Make sure bot is not already running elsewhere

### No Notifications
- Verify `TELEGRAM_ADMIN_CHAT_ID` is set correctly
- Check server logs for error messages
- Send `/status` to bot to verify configuration

### Email Not Sending
- Configure SMTP settings in `.env` file
- Check your email provider's app password requirements
- Verify email service is working in logs

### Screenshot Not Showing
- Check if `APP_URL` is correctly configured
- Verify file upload directory permissions
- Make sure screenshots are accessible via web

## 🔒 Security Notes

- Keep your bot token secure and never share it
- Only add trusted admin chat IDs
- Use HTTPS in production for screenshot security
- Regularly monitor bot activity

## 🎉 Success!

Once set up correctly, you'll have:
- ⚡ **Instant notifications** for all top-up requests
- 🖱️ **One-click approvals/rejections** 
- 📧 **Automatic email notifications**
- 📱 **Mobile admin management**

This makes managing wallet top-ups incredibly efficient! You can approve requests from anywhere using just your phone. 🚀 