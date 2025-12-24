const { FLASH_KEYS } = require('../constants/messages');

/**
 * Flash a message and redirect to a specified path
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} flashType - Type of flash message (use FLASH_KEYS constants)
 * @param {string} message - Message to flash
 * @param {string} redirectPath - Path to redirect to
 */
function flashAndRedirect(req, res, flashType, message, redirectPath) {
  req.flash(flashType, message);
  res.redirect(redirectPath);
}

/**
 * Flash a success message and redirect
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {string} redirectPath - Path to redirect to
 */
function successRedirect(req, res, message, redirectPath) {
  flashAndRedirect(req, res, FLASH_KEYS.SUCCESS, message, redirectPath);
}

/**
 * Flash an error message and redirect
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} redirectPath - Path to redirect to
 */
function errorRedirect(req, res, message, redirectPath) {
  flashAndRedirect(req, res, FLASH_KEYS.ERROR, message, redirectPath);
}

module.exports = {
  flashAndRedirect,
  successRedirect,
  errorRedirect
};
