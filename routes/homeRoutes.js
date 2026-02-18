const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Home page
router.get('/', homeController.index);

// About page
router.get('/about', homeController.about);

// Contact page (GET)
router.get('/contact', homeController.contact);

// Contact form submission (POST)
router.post('/contact', homeController.submitContact);

module.exports = router; 