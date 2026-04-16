const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const PaymentMethod = require('../models/PaymentMethod');
const telegramService = require('../services/telegramService');
const loggingService = require('../services/loggingService');
const { logUserActivity } = require('../middleware/loggingMiddleware');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const walletController = {
  // GET /wallet - Show user wallet page (ML style)
  index: async (req, res) => {
    try {
      if (!req.session.user) {
        return res.redirect('/users/login');
      }

      // Log wallet page access
      await logUserActivity(req, 'WALLET_ACCESS', {
        action: 'view_wallet_page'
      });

      // Get or create wallet for user
      let wallet = await Wallet.findByUserId(req.session.user.id);
      if (!wallet) {
        wallet = await Wallet.create({
          userId: req.session.user.id,
          balance_mmk: 0,
          balance_thb: 0
        });

        // Log wallet creation
        await logUserActivity(req, 'WALLET_CREATED', {
          walletId: wallet.id,
          initialBalance: { mmk: 0, thb: 0 }
        });
      }

      const [transactions, paymentMethods] = await Promise.all([
        Transaction.findByUserId(req.session.user.id),
        PaymentMethod.findAll({
          where: { is_active: 'active' },
          order: [['region', 'ASC'], ['payment_type', 'ASC'], ['account_name', 'ASC']]
        })
      ]);

      // Add wallet to user object for template
      const userWithWallet = {
        ...req.session.user,
        wallet: wallet
      };

      res.render('ml/wallet', {
        title: 'Wallet - ML Diamonds Store',
        user: userWithWallet,
        transactions: transactions || [],
        paymentMethods: paymentMethods || [],
        successToast: req.session.successToast || null,
        errorToast: req.session.errorToast || null
      });

      // Clear session messages after displaying
      delete req.session.successToast;
      delete req.session.errorToast;
    } catch (error) {
      console.error('Wallet index error:', error);
      
      // Log wallet access error
      loggingService.logError('WALLET_ACCESS_ERROR', error, {
        userId: req.session.user ? req.session.user.id : null,
        userEmail: req.session.user ? req.session.user.email : null,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });

      res.render('ml/wallet', {
        title: 'Wallet - ML Diamonds Store',
        user: { ...req.session.user, wallet: { balance_mmk: 0, balance_thb: 0 } },
        transactions: [],
        paymentMethods: [],
        errorToast: 'Failed to load wallet information.'
      });
    }
  },

  // GET /wallet/topup - Show top-up form
  showTopup: async (req, res) => {
    if (!req.session.user) {
      return res.redirect('/users/login');
    }

    // Log top-up form access
    await logUserActivity(req, 'WALLET_TOPUP_FORM_ACCESS', {
      currency: req.query.currency || 'MMK'
    });

    res.render('wallet/topup', {
      title: 'Top Up Wallet - ML Diamonds',
      user: req.session.user,
      currency: req.query.currency || 'MMK'
    });
  },

  // POST /wallet/topup - Submit top-up request
  submitTopup: [
    upload.single('screenshot'),
    async (req, res) => {
      try {
        if (!req.session.user) {
          return res.redirect('/users/login');
        }

        const {
          currency,
          selectedAmount,
          amount,
          payment_type,
          sender_account_name
        } = req.body;

        console.log('📋 Top-up form data:', req.body);
        console.log('📎 Uploaded file:', req.file);

        // Log top-up attempt
        await logUserActivity(req, 'WALLET_TOPUP_ATTEMPT', {
          currency: req.body.currency,
          selectedAmount: req.body.selectedAmount,
          customAmount: req.body.amount,
          paymentType: req.body.payment_type,
          hasScreenshot: !!req.file
        });

        // Determine final amount (selectedAmount for preset buttons, amount for custom input)
        let finalAmount;
        if (selectedAmount && selectedAmount !== '' && selectedAmount !== '0') {
          finalAmount = parseFloat(selectedAmount);
        } else if (amount && amount !== '') {
          finalAmount = parseFloat(amount);
        } else {
          finalAmount = 0;
        }

        console.log('💰 Amount calculation:', { selectedAmount, amount, finalAmount });

        // Validation with detailed logging
        const validationErrors = [];
        if (!currency) validationErrors.push('Currency is required');
        if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) validationErrors.push('Valid amount is required');
        if (!payment_type) validationErrors.push('Payment method is required');
        if (!sender_account_name) validationErrors.push('Account name is required');
        // Account number validation removed - no longer needed

        if (validationErrors.length > 0) {
          console.log('❌ Validation errors:', validationErrors);
          console.log('📋 Form data received:', { currency, selectedAmount, amount, payment_type, sender_account_name });
          
          // Log validation failure
          await logUserActivity(req, 'WALLET_TOPUP_VALIDATION_FAILED', {
            errors: validationErrors,
            formData: { currency, selectedAmount, amount, payment_type, sender_account_name }
          }, false);
          
          return res.redirect(`/wallet?error=${encodeURIComponent('Please fill in all required fields: ' + validationErrors.join(', '))}`);
        }

        if (!req.file) {
          // Log missing screenshot
          await logUserActivity(req, 'WALLET_TOPUP_MISSING_SCREENSHOT', {
            formData: { currency, finalAmount, payment_type, sender_account_name }
          }, false);
          
          return res.redirect(`/wallet?error=${encodeURIComponent('Please upload a payment screenshot.')}`);
        }

        if (finalAmount <= 0) {
          // Log invalid amount
          await logUserActivity(req, 'WALLET_TOPUP_INVALID_AMOUNT', {
            attemptedAmount: finalAmount,
            currency: currency
          }, false);
          
          return res.redirect(`/wallet?error=${encodeURIComponent(`Minimum top-up amount is 1 ${currency}.`)}`);
        }

        // Create transaction record
        const transaction = await Transaction.create({
          userId: req.session.user.id,
          userName: req.session.user.name,
          payment_type,
          sender_account_name,
          amount: finalAmount,
          currency,
          screenshot: req.file.filename,
          status: 'pending'
        });

        // Log successful top-up submission
        await logUserActivity(req, 'WALLET_TOPUP_SUBMITTED', {
          transactionId: transaction.id,
          amount: finalAmount,
          currency: currency,
          paymentType: payment_type,
          senderAccountName: sender_account_name,
          screenshotFile: req.file.filename,
          status: 'pending'
        });

        console.log(`💰 Top-up request submitted:`, {
          user: req.session.user.name,
          amount: finalAmount,
          currency,
          payment_type,
          transactionId: transaction.id
        });

        // Send Telegram notification to admin
        try {
          await telegramService.sendTopUpNotification(transaction);
          console.log('✅ Telegram notification sent to admin');
          
          // Log successful notification
          await logUserActivity(req, 'WALLET_TOPUP_NOTIFICATION_SENT', {
            transactionId: transaction.id,
            notificationType: 'telegram'
          });
        } catch (telegramError) {
          console.error('❌ Failed to send Telegram notification:', telegramError);
          
          // Log notification failure
          loggingService.logError('WALLET_TOPUP_NOTIFICATION_FAILED', telegramError, {
            userId: req.session.user.id,
            userEmail: req.session.user.email,
            transactionId: transaction.id,
            notificationType: 'telegram'
          });
          
          // Don't fail the transaction if Telegram fails
        }

        const successMessage = `🎉 Top-up request submitted successfully! Amount: ${finalAmount.toLocaleString()} ${currency}. Admin has been notified and you will receive an email notification once processed.`;
        res.redirect(`/wallet?success=${encodeURIComponent(successMessage)}`);
      } catch (error) {
        console.error('Top-up submission error:', error);
        
        // Log top-up submission error
        loggingService.logError('WALLET_TOPUP_SUBMISSION_ERROR', error, {
          userId: req.session.user ? req.session.user.id : null,
          userEmail: req.session.user ? req.session.user.email : null,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          formData: req.body,
          hasFile: !!req.file
        });
        
        res.redirect(`/wallet?error=${encodeURIComponent('Failed to submit top-up request. Please try again.')}`);
      }
    }
  ],

  // GET /wallet/transactions - Show user transaction history
  transactions: async (req, res) => {
    try {
      if (!req.session.user) {
        return res.redirect('/users/login');
      }

      const transactions = await Transaction.findByUserId(req.session.user.id);

      res.render('wallet/transactions', {
        title: 'Transaction History - ML Diamonds',
        user: req.session.user,
        transactions: transactions || []
      });
    } catch (error) {
      console.error('Transaction history error:', error);
      res.render('wallet/transactions', {
        title: 'Transaction History - ML Diamonds',
        user: req.session.user,
        transactions: [],
        errorToast: 'Failed to load transaction history.'
      });
    }
  },

  // GET /wallet/api/balance - Get current wallet balance (API endpoint)
  getBalance: async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get fresh wallet data from database
      const wallet = await Wallet.findByUserId(req.session.user.id);

      if (!wallet) {
        return res.json({
          balance_mmk: 0,
          balance_thb: 0
        });
      }

      res.json({
        balance_mmk: parseFloat(wallet.balance_mmk),
        balance_thb: parseFloat(wallet.balance_thb)
      });
    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({ error: 'Failed to get balance' });
    }
  }
};

module.exports = walletController;