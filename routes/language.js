const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * POST /language/change
 * Changes the user's language preference
 */
router.post('/change', (req, res) => {
  const { lang } = req.body;
  const supportedLangs = ['el', 'en'];

  if (!supportedLangs.includes(lang)) {
    logger.warn('Invalid language change attempt', { lang, ip: req.ip });
    return res.redirect('back');
  }

  // Store in session
  req.session.language = lang;

  // Update i18next language
  if (req.i18n) {
    req.i18n.changeLanguage(lang);
  }

  logger.info('Language changed', {
    lang,
    userId: req.session?.user?.id || 'anonymous',
    ip: req.ip
  });

  // Redirect back to previous page or home
  const referer = req.get('Referer') || '/';

  // Save session explicitly before redirect to ensure persistence
  req.session.save((err) => {
    if (err) {
      logger.error('Failed to save session', { error: err.message });
    }
    res.redirect(referer);
  });
});

/**
 * GET /language/:lang
 * Alternative route for language switching (for direct links)
 */
router.get('/:lang', (req, res) => {
  const { lang } = req.params;
  const supportedLangs = ['el', 'en'];

  if (!supportedLangs.includes(lang)) {
    return res.redirect('back');
  }

  // Store in session
  req.session.language = lang;

  // Update i18next language
  if (req.i18n) {
    req.i18n.changeLanguage(lang);
  }

  logger.info('Language changed via GET', {
    lang,
    userId: req.session?.user?.id || 'anonymous',
    ip: req.ip
  });

  // Redirect back to previous page or home
  const referer = req.get('Referer') || '/';

  // Save session explicitly before redirect to ensure persistence
  req.session.save((err) => {
    if (err) {
      logger.error('Failed to save session', { error: err.message });
    }
    res.redirect(referer);
  });
});

module.exports = router;
