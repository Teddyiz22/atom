# Email Notification Setup Guide

## Overview
The wallet system now includes email notifications for transaction approvals and rejections.

## Required Environment Variables

Add these variables to your `.env` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
WEBSITE_URL=http://localhost:3000
```

## Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password (not your regular Gmail password) in `SMTP_PASS`

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

## Features

### 📧 Approval Email
- Beautiful HTML template with transaction details
- Includes transaction ID, amount, payment method
- Direct link to wallet page
- Professional branding

### ❌ Rejection Email
- Clear rejection notification
- Includes rejection reason
- Encourages user to try again
- Support contact information

## Testing

1. Submit a wallet top-up request
2. Go to admin panel → Transactions
3. Approve or reject the transaction
4. Check the user's email for notification

## Troubleshooting

### Email not sending?
1. Check console logs for email service errors
2. Verify SMTP credentials are correct
3. Ensure Gmail app password is used (not regular password)
4. Check spam/junk folder

### Email looks broken?
- Most email clients support HTML emails
- Gmail, Outlook, Apple Mail all render correctly
- Fallback text is included for older clients

## Security Notes

- Never commit `.env` file to version control
- Use app passwords, not regular passwords
- Keep SMTP credentials secure
- Consider using dedicated email service for production 