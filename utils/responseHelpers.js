const { FLASH_KEYS } = require('../constants/messages');

/**
 * Flash a message and redirect to a specified path
 * Supports i18n translation keys (format: 'namespace:key.subkey')
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} flashType - Type of flash message (use FLASH_KEYS constants)
 * @param {string} messageOrKey - Message string or translation key
 * @param {string} redirectPath - Path to redirect to
 * @param {Object} interpolation - Optional interpolation values for translation
 */
function flashAndRedirect(req, res, flashType, messageOrKey, redirectPath, interpolation = {}) {
  // Check if this looks like a translation key (contains colon for namespace)
  const isTranslationKey = messageOrKey && messageOrKey.includes(':');

  // Translate if i18n is available and this is a translation key
  const message = (req.t && isTranslationKey)
    ? req.t(messageOrKey, interpolation)
    : messageOrKey;

  req.flash(flashType, message);
  res.redirect(redirectPath);
}

/**
 * Flash a success message and redirect
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} messageOrKey - Success message or translation key
 * @param {string} redirectPath - Path to redirect to
 * @param {Object} interpolation - Optional interpolation values
 */
function successRedirect(req, res, messageOrKey, redirectPath, interpolation = {}) {
  flashAndRedirect(req, res, FLASH_KEYS.SUCCESS, messageOrKey, redirectPath, interpolation);
}

/**
 * Flash an error message and redirect
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} messageOrKey - Error message or translation key
 * @param {string} redirectPath - Path to redirect to
 * @param {Object} interpolation - Optional interpolation values
 */
function errorRedirect(req, res, messageOrKey, redirectPath, interpolation = {}) {
  flashAndRedirect(req, res, FLASH_KEYS.ERROR, messageOrKey, redirectPath, interpolation);
}

module.exports = {
  flashAndRedirect,
  successRedirect,
  errorRedirect
};
