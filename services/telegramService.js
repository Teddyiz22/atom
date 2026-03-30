const TelegramBot = require('node-telegram-bot-api');
const Transaction = require('../models/Transaction');
const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const emailService = require('./emailService');

class TelegramService {
  constructor() {
    this.bot = null;
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.pendingRejections = new Map(); // Initialize the Map for pending rejections
    this.enabled = false;

    if (this.token) {
      this.bot = new TelegramBot(this.token, { polling: false });
      this.attachBotErrorHandlers();
      this.setupBot();
      this.initializeBot();
    } else {
      console.log('⚠️  Telegram bot token not found. Telegram notifications disabled.');
    }
  }

  attachBotErrorHandlers() {
    if (!this.bot) return;

    this.bot.on('polling_error', async (error) => {
      const statusCode = error?.response?.statusCode;
      const message = error?.message || '';

      if (statusCode === 401 || message.includes('401 Unauthorized')) {
        console.error('❌ Telegram bot unauthorized. Disabling Telegram bot.');
        await this.disableBot();
        return;
      }

      console.error('Telegram polling error:', error);
    });
  }

  async initializeBot() {
    if (!this.bot) return;

    try {
      // Clear any webhook so getUpdates (polling) receives callback_query and messages.
      // If a webhook was left from another deploy or Bot API test, buttons appear but never fire here.
      await this.bot.deleteWebHook({ drop_pending_updates: false });
      await this.bot.getMe();
      this.enabled = true;
      await this.bot.startPolling();
      console.log('✅ Telegram bot polling started (webhook cleared).');
    } catch (error) {
      const msg = error?.message || String(error);
      if (msg.includes('409') || msg.includes('Conflict')) {
        console.error(
          '❌ Telegram bot: another process is already receiving updates for this token (409). ' +
            'Stop duplicate PM2 workers / other servers using the same TELEGRAM_BOT_TOKEN.'
        );
      }
      console.error('❌ Telegram bot initialization failed:', msg);
      await this.disableBot();
    }
  }

  async disableBot() {
    this.enabled = false;
    if (!this.bot) return;

    try {
      await this.bot.stopPolling();
    } catch (error) {
      console.error('Error stopping Telegram bot polling:', error?.message || error);
    }

    this.bot.removeAllListeners();
    this.bot = null;
  }

  setupBot() {
    console.log('🤖 Setting up Telegram bot...');

    // Handle /start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🤖 *ATOM Game Shop Admin Bot*

Welcome! This bot will help you manage wallet top-up requests.

*Available Commands:*
• /start - Show this welcome message
• /help - Show help information
• /status - Check bot status

*Features:*
• Receive instant notifications for new top-up requests
• View user details and payment screenshots
• Approve or reject requests with inline buttons
• Add rejection reasons
• Automatic email notifications to users

To get started, make sure your chat ID is configured in the system.
Your chat ID: \`${chatId}\`
      `;

      this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });

      // If admin chat ID is not set, suggest using this chat ID
      if (!this.adminChatId) {
        this.bot.sendMessage(chatId,
          `💡 *Setup Required:*\n` +
          `It looks like the admin chat ID is not configured yet.\n` +
          `Add this chat ID to your environment variables:\n` +
          `\`TELEGRAM_ADMIN_CHAT_ID=${chatId}\``,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Handle /help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
🔧 *ATOM Game Shop Admin Bot - Help*

*How it works:*
1. User submits a wallet top-up request
2. You receive instant notification here
3. Review user details and payment screenshot
4. Use buttons to approve or reject
5. User gets email notification of decision

*Button Actions:*
• ✅ *Approve* - Add money to user wallet
• ❌ *Reject* - Ask for reason and notify user
• 📷 *View Screenshot* - See payment proof

*Tips:*
• Always verify payment screenshots before approving
• Provide clear reasons when rejecting requests
• Check user account details for suspicious activity
      `;

      this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Handle /status command
    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      const statusMessage = `
📊 *Bot Status*

🤖 Bot: Online ✅
📱 Chat ID: \`${chatId}\`
🔑 Admin Chat: ${this.adminChatId ? '✅ Configured' : '❌ Not Set'}
🌐 Polling: Active ✅

*Last Update:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}
      `;

      this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });

    // Handle callback queries (button presses)
    this.bot.on('callback_query', async (callbackQuery) => {
      const action = callbackQuery.data;
      const msg = callbackQuery.message;
      const chatId = msg.chat.id;

      try {
        // Telegram expects answerCallbackQuery within ~10s or the client stays "loading".
        // Approve/reject work can exceed that, so acknowledge immediately.
        await this.bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

        if (action.startsWith('approve_')) {
          const transactionId = action.replace('approve_', '');
          await this.handleApproval(transactionId, chatId, msg.message_id);
        } else if (action.startsWith('reject_')) {
          const transactionId = action.replace('reject_', '');
          await this.handleRejectionRequest(transactionId, chatId, msg.message_id);
        } else if (action.startsWith('manual_approve_')) {
          const purchaseId = action.replace('manual_approve_', '');
          await this.handleManualOrderApproval(purchaseId, chatId, msg.message_id);
        } else if (action.startsWith('manual_reject_')) {
          const purchaseId = action.replace('manual_reject_', '');
          await this.handleManualOrderRejection(purchaseId, chatId, msg.message_id);
        } else if (action.startsWith('confirm_reject_')) {
          const parts = action.split('confirm_reject_')[1].split('_');
          const transactionId = parts[0];
          const reason = parts.slice(1).join('_');
          await this.handleRejection(transactionId, reason, chatId, msg.message_id);
        }
      } catch (error) {
        console.error('Error handling callback query:', error);
        try {
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Error occurred',
            show_alert: true
          });
        } catch (_) {
          // Already answered above
        }
      }
    });

    // Handle text messages (for rejection reasons)
    this.bot.on('message', async (msg) => {
      try {
        // Skip if it's a command message
        if (msg.text && msg.text.startsWith('/')) {
          return;
        }

        // Check if this chat has a pending rejection
        if (this.pendingRejections && this.pendingRejections.has(msg.chat.id)) {
          const pendingRejection = this.pendingRejections.get(msg.chat.id);
          const { transactionId, messageId } = pendingRejection;

          // Use the message text as the rejection reason
          const reason = msg.text.trim();

          if (reason && reason.length > 0) {
            // Clear the pending rejection
            this.pendingRejections.delete(msg.chat.id);

            // Process the rejection with the custom reason
            await this.handleRejection(transactionId, reason, msg.chat.id, messageId);

            // Delete the user's message to keep chat clean
            try {
              await this.bot.deleteMessage(msg.chat.id, msg.message_id);
            } catch (deleteError) {
              // Ignore delete errors (message might be too old)
              console.log('Could not delete user message:', deleteError.message);
            }
          } else {
            // Ask for a valid reason
            await this.bot.sendMessage(
              msg.chat.id,
              '❌ Please provide a valid rejection reason. Type your reason and send it.',
              { reply_to_message_id: msg.message_id }
            );
          }
        }
      } catch (error) {
        console.error('Error handling text message for rejection:', error);
        // Try to send error message to user
        try {
          await this.bot.sendMessage(
            msg.chat.id,
            '❌ Error processing rejection. Please try again or contact admin.',
            { reply_to_message_id: msg.message_id }
          );
        } catch (sendError) {
          console.error('Could not send error message:', sendError);
        }
      }
    });

    console.log('✅ Telegram bot setup complete!');
  }

  async sendTopUpNotification(transaction) {
    if (!this.bot || !this.enabled || !this.adminChatId) {
      console.log('⚠️  Telegram bot not configured. Skipping notification.');
      return;
    }

    try {
      // Get user details
      const user = await User.findByPk(transaction.userId);
      if (!user) {
        console.error('User not found for transaction:', transaction.id);
        return;
      }

      const message = `
🔔 *New Wallet Top-Up Request*

👤 *User Details:*
• Name: ${user.name}
• Email: ${user.email}
• User ID: ${user.id}

💰 *Transaction Details:*
• Amount: ${parseFloat(transaction.amount).toLocaleString()} ${transaction.currency}
• Payment Method: ${transaction.payment_type}
• Sender: ${transaction.sender_account_name}
• Date: ${new Date(transaction.created_at).toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}

📋 *Transaction ID:* \`${transaction.id}\`

*Status:* Pending Approval ⏳
      `;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approve_${transaction.id}` },
            { text: '❌ Reject', callback_data: `reject_${transaction.id}` }
          ]
        ]
      };

      // Send message first
      const sentMessage = await this.bot.sendMessage(
        this.adminChatId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

      // Send screenshot if available
      if (transaction.screenshot) {
        const screenshotPath = `${process.env.APP_URL || 'http://localhost:3000'}/uploads/${transaction.screenshot}`;

        try {
          await this.bot.sendPhoto(
            this.adminChatId,
            screenshotPath,
            {
              caption: `💳 Payment Screenshot for Transaction #${transaction.id}`,
              reply_to_message_id: sentMessage.message_id
            }
          );
        } catch (photoError) {
          console.error('Error sending screenshot:', photoError);
          // Send a message about the screenshot error
          await this.bot.sendMessage(
            this.adminChatId,
            `📷 Screenshot available at: ${screenshotPath}`,
            { reply_to_message_id: sentMessage.message_id }
          );
        }
      }

      console.log(`✅ Telegram notification sent for transaction #${transaction.id}`);
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
    }
  }

  async sendManualGameOrderNotification(purchase) {
    if (!this.bot || !this.enabled || !this.adminChatId) {
      console.log('⚠️  Telegram bot not configured. Skipping manual game order notification.');
      return;
    }

    try {
      const user = await User.findByPk(purchase.user_id).catch(() => null);
      const createdAt = purchase.created_at || new Date();
      let customerNote = '';
      try {
        const raw = purchase.delivery_items ? JSON.parse(purchase.delivery_items) : null;
        customerNote = raw?.customer_note ? String(raw.customer_note) : '';
      } catch (_) {}

      const message = `
🔔 *New Game order request*

*User detail*
• Name: ${user?.name || purchase.user_name || 'Unknown'}
• User ID: ${purchase.user_id}
• Email: ${user?.email || 'Unknown'}

*Game order*
• Order ID: \`${purchase.id}\`
• Game Type: ${purchase.product_type_code || 'pubgcustom'}
• Purchase: ${purchase.product_name || '-'}
• Game ID: ${purchase.player_id || '-'}
• Server ID: ${purchase.server_id || '-'}
• Amount: ${Number(purchase.total_amount || 0).toLocaleString()} ${purchase.currency || ''}
• Date Time: ${new Date(createdAt).toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}
${customerNote ? `• Note: ${customerNote}` : ''}

*Status:* Pending Approval ⏳
      `;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `manual_approve_${purchase.id}` },
            { text: '❌ Reject', callback_data: `manual_reject_${purchase.id}` }
          ]
        ]
      };

      await this.bot.sendMessage(this.adminChatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      console.log(`✅ Telegram manual order notification sent for purchase #${purchase.id}`);
    } catch (error) {
      console.error('Error sending manual game order Telegram notification:', error);
    }
  }

  async handleManualOrderApproval(purchaseId, chatId, messageId) {
    const { sequelize } = require('../models');
    const t = await sequelize.transaction();
    try {
      const purchase = await GamePurchaseTransaction.findByPk(purchaseId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!purchase || purchase.provider !== 'manual') {
        await t.rollback();
        await this.bot.editMessageText('❌ Manual order not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      if (purchase.status !== 'pending') {
        await t.rollback();
        await this.bot.editMessageText(`❌ Manual order already ${purchase.status}.`, { chat_id: chatId, message_id: messageId });
        return;
      }

      await purchase.update(
        {
          status: 'completed',
          order_id: purchase.order_id || String(purchase.id),
          updated_at: new Date()
        },
        { transaction: t }
      );
      await t.commit();

      const approvedMsg = `
✅ *APPROVED* - Manual Order #${purchase.id}

• User ID: ${purchase.user_id}
• Purchase: ${purchase.product_name}
• Game Type: ${purchase.product_type_code}
• Game ID: ${purchase.player_id || '-'}
• Server ID: ${purchase.server_id || '-'}
• Amount: ${Number(purchase.total_amount || 0).toLocaleString()} ${purchase.currency}
• Approved: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}

Payment confirmed. Customer deduction remains applied.
      `;

      await this.bot.editMessageText(approvedMsg, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      try { await t.rollback(); } catch (_) {}
      console.error('Error handling manual order approval:', error);
      await this.bot.editMessageText(
        '❌ Error processing manual order approval. Please check admin panel.',
        { chat_id: chatId, message_id: messageId }
      );
    }
  }

  async handleManualOrderRejection(purchaseId, chatId, messageId) {
    const { sequelize } = require('../models');
    const t = await sequelize.transaction();
    try {
      const purchase = await GamePurchaseTransaction.findByPk(purchaseId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!purchase || purchase.provider !== 'manual') {
        await t.rollback();
        await this.bot.editMessageText('❌ Manual order not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      if (purchase.status !== 'pending') {
        await t.rollback();
        await this.bot.editMessageText(`❌ Manual order already ${purchase.status}.`, { chat_id: chatId, message_id: messageId });
        return;
      }

      const wallet = await Wallet.findOne({
        where: { userId: purchase.user_id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!wallet) {
        await t.rollback();
        await this.bot.editMessageText('❌ User wallet not found for refund.', { chat_id: chatId, message_id: messageId });
        return;
      }

      const refundAmount = Number(purchase.total_amount || 0);
      const balanceField = purchase.currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
      const currentBalance = Number(wallet[balanceField] || 0);
      await wallet.update({ [balanceField]: currentBalance + refundAmount }, { transaction: t });

      await purchase.update(
        {
          status: 'fail',
          refunded_amount: refundAmount,
          failure_reason: 'Rejected by Telegram admin',
          updated_at: new Date()
        },
        { transaction: t }
      );
      await t.commit();

      const rejectedMsg = `
❌ *REJECTED* - Manual Order #${purchase.id}

• User ID: ${purchase.user_id}
• Purchase: ${purchase.product_name}
• Game Type: ${purchase.product_type_code}
• Game ID: ${purchase.player_id || '-'}
• Server ID: ${purchase.server_id || '-'}
• Amount: ${refundAmount.toLocaleString()} ${purchase.currency}
• Rejected: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}

Customer refunded successfully.
      `;

      await this.bot.editMessageText(rejectedMsg, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      try { await t.rollback(); } catch (_) {}
      console.error('Error handling manual order rejection:', error);
      await this.bot.editMessageText(
        '❌ Error processing manual order rejection. Please check admin panel.',
        { chat_id: chatId, message_id: messageId }
      );
    }
  }

  async handleApproval(transactionId, chatId, messageId) {
    try {
      const transaction = await Transaction.findByPk(transactionId, {
        include: [{ model: User }]
      });

      if (!transaction) {
        await this.bot.editMessageText(
          '❌ Transaction not found.',
          { chat_id: chatId, message_id: messageId }
        );
        return;
      }

      if (transaction.status !== 'pending') {
        await this.bot.editMessageText(
          `❌ Transaction already ${transaction.status}.`,
          { chat_id: chatId, message_id: messageId }
        );
        return;
      }

      // Update transaction status
      await transaction.update({
        status: 'approved',
        updated_by: 'Telegram Bot Admin'
      });

      // Update user wallet
      const wallet = await Wallet.findOne({ where: { userId: transaction.userId } });
      if (wallet) {
        const balanceField = transaction.currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
        const currentBalance = parseFloat(wallet[balanceField]) || 0;
        const newBalance = currentBalance + parseFloat(transaction.amount);

        await wallet.update({ [balanceField]: newBalance });
      }

      // Send approval email to user
      if (emailService && transaction.User) {
        try {
          console.log(`📧 Sending approval email to ${transaction.User.email}`);
          await emailService.sendApprovalEmail(
            transaction.User.email,
            transaction.User.name,
            transaction
          );
          console.log(`✅ Approval email sent successfully to ${transaction.User.email}`);
        } catch (emailError) {
          console.error('❌ Error sending approval email:', emailError);
        }
      } else {
        console.log('⚠️ Email service not available or user not found');
      }

      // Update Telegram message
      const updateMessage = `
✅ *APPROVED* - Transaction #${transactionId}

💰 Amount: ${parseFloat(transaction.amount).toLocaleString()} ${transaction.currency}
👤 User: ${transaction.User.name}
📧 Email: ${transaction.User.email}
⏰ Approved: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}

✉️ Approval email sent to user.
      `;

      await this.bot.editMessageText(
        updateMessage,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );

      console.log(`✅ Transaction #${transactionId} approved via Telegram`);
    } catch (error) {
      console.error('Error handling approval:', error);
      await this.bot.editMessageText(
        '❌ Error processing approval. Please check the admin panel.',
        { chat_id: chatId, message_id: messageId }
      );
    }
  }

  async handleRejectionRequest(transactionId, chatId, messageId) {
    try {
      // Store the transaction ID and message ID for later reference
      this.pendingRejections.set(chatId, { transactionId, messageId });

      await this.bot.editMessageText(
        `❌ *Rejecting Transaction #${transactionId}*\n\n` +
        `Please type your rejection reason and send it as a message.\n\n` +
        `Example: "Payment screenshot is unclear, please resubmit with better quality"\n\n` +
        `💡 Your next message will be used as the rejection reason.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );

      console.log(`📝 Waiting for rejection reason for transaction #${transactionId}`);
    } catch (error) {
      console.error('Error in handleRejectionRequest:', error);
      await this.bot.editMessageText(
        '❌ Error processing rejection request. Please try again.',
        { chat_id: chatId, message_id: messageId }
      );
    }
  }

  async handleRejection(transactionId, reason, chatId, messageId) {
    try {
      console.log(`🔄 Processing rejection for transaction #${transactionId} with reason: ${reason}`);

      const transaction = await Transaction.findByPk(transactionId, {
        include: [{ model: User }]
      });

      if (!transaction) {
        console.error(`❌ Transaction #${transactionId} not found`);
        await this.bot.editMessageText(
          '❌ Transaction not found.',
          { chat_id: chatId, message_id: messageId }
        );
        return;
      }

      if (transaction.status !== 'pending') {
        console.log(`⚠️ Transaction #${transactionId} already ${transaction.status}`);
        await this.bot.editMessageText(
          `❌ Transaction already ${transaction.status}.`,
          { chat_id: chatId, message_id: messageId }
        );
        return;
      }

      // Clean up reason text
      const cleanReason = reason.replace(/_/g, ' ');

      console.log(`📝 Updating transaction #${transactionId} status to rejected`);

      // Update transaction status
      await transaction.update({
        status: 'rejected',
        reason: cleanReason,
        updated_by: 'Telegram Bot Admin'
      });

      console.log(`✅ Transaction #${transactionId} status updated to rejected`);

      // Send rejection email to user
      if (emailService && transaction.User) {
        try {
          console.log(`📧 Sending rejection email to ${transaction.User.email}`);
          await emailService.sendRejectionEmail(
            transaction.User.email,
            transaction.User.name,
            transaction,
            cleanReason
          );
          console.log(`✅ Rejection email sent successfully to ${transaction.User.email}`);
        } catch (emailError) {
          console.error('❌ Error sending rejection email:', emailError);
        }
      } else {
        console.log('⚠️ Email service not available or user not found');
      }

      // Update Telegram message
      const updateMessage = `
❌ *REJECTED* - Transaction #${transactionId}

💰 Amount: ${parseFloat(transaction.amount).toLocaleString()} ${transaction.currency}
👤 User: ${transaction.User ? transaction.User.name : 'Unknown'}
📧 Email: ${transaction.User ? transaction.User.email : 'Unknown'}
📝 Reason: ${cleanReason}
⏰ Rejected: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}

✉️ Rejection email sent to user.
      `;

      await this.bot.editMessageText(
        updateMessage,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );

      console.log(`✅ Transaction #${transactionId} rejected successfully via Telegram`);
    } catch (error) {
      console.error('❌ Error handling rejection:', error);
      try {
        await this.bot.editMessageText(
          '❌ Error processing rejection. Please check the admin panel.',
          { chat_id: chatId, message_id: messageId }
        );
      } catch (editError) {
        console.error('Could not update error message:', editError);
      }
    }
  }

  async sendTestMessage() {
    if (!this.bot || !this.adminChatId) {
      console.log('⚠️  Telegram bot not configured for testing.');
      return false;
    }

    try {
      await this.bot.sendMessage(
        this.adminChatId,
        '🧪 *Test Message*\n\nTelegram bot is working correctly! ✅',
        { parse_mode: 'Markdown' }
      );
      return true;
    } catch (error) {
      console.error('Error sending test message:', error);
      return false;
    }
  }
}

// Create singleton instance
const telegramService = new TelegramService();

module.exports = telegramService; 
