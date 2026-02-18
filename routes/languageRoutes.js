const express = require('express');
const router = express.Router();
const { changeLanguage } = require('../controllers/languageController');

// Change language route
router.get('/change/:lang', changeLanguage);

module.exports = router; 