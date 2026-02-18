const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// Middleware to disable layout for wallet routes (they have their own HTML structure)
const disableLayout = (req, res, next) => {
  res.locals.layout = false;
  next();
};

// Apply to all wallet routes
router.use(disableLayout);

// Wallet routes
router.get('/', walletController.index);                    // GET /wallet
router.get('/api/balance', walletController.getBalance);    // GET /wallet/api/balance
router.get('/topup', walletController.showTopup);          // GET /wallet/topup
router.post('/topup', walletController.submitTopup);       // POST /wallet/topup
router.get('/transactions', walletController.transactions); // GET /wallet/transactions

module.exports = router; 