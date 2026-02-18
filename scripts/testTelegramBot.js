require('dotenv').config();
const telegramService = require('../services/telegramService');

async function testTelegramBot() {
  console.log('🧪 Testing Telegram Bot Integration...\n');

  // Check if bot token is configured
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
    console.log('Please add your bot token to the .env file:');
    console.log('TELEGRAM_BOT_TOKEN=8100112493:AAGh7XK2s9qFylQY1eXSt7jPRX0c4Td_VSY');
    return;
  }

  // Check if admin chat ID is configured
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID) {
    console.log('⚠️  TELEGRAM_ADMIN_CHAT_ID not found in environment variables');
    console.log('To get your chat ID:');
    console.log('1. Send /start to your bot in Telegram');
    console.log('2. The bot will show your chat ID');
    console.log('3. Add it to your .env file: TELEGRAM_ADMIN_CHAT_ID=your_chat_id');
    console.log('\nTesting bot without admin chat ID...\n');
  }

  // Test basic bot configuration
  console.log('🔧 Bot Configuration:');
  console.log(`   Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Admin Chat ID: ${process.env.TELEGRAM_ADMIN_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   App URL: ${process.env.APP_URL || 'http://localhost:3000'}`);
  console.log('');

  // Test sending a message if admin chat ID is set
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
    console.log('📤 Testing message sending...');

    try {
      const result = await telegramService.sendTestMessage();
      if (result) {
        console.log('✅ Test message sent successfully!');
        console.log('Check your Telegram to see the message.');
      } else {
        console.log('❌ Failed to send test message');
      }
    } catch (error) {
      console.log('❌ Error sending test message:', error.message);
    }
  }

  console.log('\n🎯 Next Steps:');
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID) {
    console.log('1. Send /start to your bot in Telegram');
    console.log('2. Copy the chat ID from the bot response');
    console.log('3. Add TELEGRAM_ADMIN_CHAT_ID to your .env file');
    console.log('4. Restart your server');
  } else {
    console.log('1. Your bot is configured correctly!');
    console.log('2. Submit a test wallet top-up to see notifications');
    console.log('3. Use the approve/reject buttons in Telegram');
    console.log('4. Check server logs for detailed error messages');
  }

  console.log('\n🔧 Troubleshooting:');
  console.log('• If rejections fail, check server logs for detailed error messages');
  console.log('• Make sure email service is properly configured');
  console.log('• Verify database connection is working');
  console.log('• Check if transaction status updates correctly in admin panel');

  console.log('\n🤖 Bot Commands:');
  console.log('   /start - Get your chat ID and welcome message');
  console.log('   /help - Show detailed help');
  console.log('   /status - Check bot status');

  console.log('\n📱 Test Complete! The bot is ready for wallet notifications.');
}

// Run the test
testTelegramBot().catch(console.error); 