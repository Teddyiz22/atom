const fs = require('fs');
const path = require('path');

// Load language files
const loadLanguage = (lang) => {
  try {
    const filePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error(`Error loading language file for ${lang}:`, error);
    return null;
  }
};

// Available languages
const availableLanguages = {
  'en': 'English',
  'mm': 'မြန်မာ'
};

// Change language
const changeLanguage = (req, res) => {
  const { lang } = req.params;

  // Validate language
  if (!availableLanguages[lang]) {
    return res.status(400).json({
      success: false,
      message: 'Invalid language'
    });
  }

  // Set language in session
  req.session.language = lang;

  // Set language in cookie for persistence
  res.cookie('language', lang, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false
  });

  // If it's an AJAX request, return JSON
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.json({
      success: true,
      message: 'Language changed successfully',
      language: lang
    });
  }

  // Otherwise redirect back to the previous page
  const redirectUrl = req.get('Referer') || '/';
  res.redirect(redirectUrl);
};

// Get current language
const getCurrentLanguage = (req) => {
  return req.session.language || req.cookies.language || 'en';
};

// Get translations for current language
const getTranslations = (req) => {
  const currentLang = getCurrentLanguage(req);
  const translations = loadLanguage(currentLang);

  // Fallback to English if translation not found
  if (!translations) {
    return loadLanguage('en') || {};
  }

  return translations;
};

// Middleware to set language data for all views
const languageMiddleware = (req, res, next) => {
  const currentLang = getCurrentLanguage(req);
  const translations = getTranslations(req);

  // Make language data available to all views
  res.locals.currentLanguage = currentLang;
  res.locals.availableLanguages = availableLanguages;
  res.locals.t = translations;
  res.locals.__ = (key) => {
    // Helper function to get nested translation
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && value.hasOwnProperty(k)) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return value || key;
  };

  next();
};

module.exports = {
  changeLanguage,
  getCurrentLanguage,
  getTranslations,
  languageMiddleware,
  availableLanguages
}; 