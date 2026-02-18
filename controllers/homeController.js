const User = require('../models/User');

const homeController = {
  // GET /
  index: (req, res) => {
    try {
      res.render('home/index', {
        title: 'Welcome to NMH Shop',
        message: 'This is the home page',
        user: req.session.user || null
      });
    } catch (error) {
      console.error('Error in home index:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // GET /about
  about: (req, res) => {
    try {
      res.render('home/about', {
        title: 'About Us',
        user: req.session.user || null
      });
    } catch (error) {
      console.error('Error in about page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // GET /contact
  contact: (req, res) => {
    try {
      res.render('home/contact', {
        title: 'Contact Us',
        user: req.session.user || null
      });
    } catch (error) {
      console.error('Error in contact page:', error);
      res.status(500).render('errors/500', {
        title: 'Server Error',
        message: 'Something went wrong.'
      });
    }
  },

  // POST /contact
  submitContact: (req, res) => {
    try {
      const { name, email, message } = req.body;

      // Here you would typically save to database
      console.log('Contact form submission:', { name, email, message });

      res.render('home/contact', {
        title: 'Contact Us',
        user: req.session.user || null,
        success: 'Thank you for your message! We will get back to you soon.'
      });
    } catch (error) {
      console.error('Error in contact submission:', error);
      res.render('home/contact', {
        title: 'Contact Us',
        user: req.session.user || null,
        error: 'Something went wrong. Please try again.'
      });
    }
  }
};

module.exports = homeController; 