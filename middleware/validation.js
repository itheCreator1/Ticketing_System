const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors for debugging
    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      body: req.body ? Object.keys(req.body) : [],
    });

    if (req.accepts('html')) {
      errors.array().forEach((error) => {
        req.flash('error_msg', error.msg);
      });
      // Redirect to referer, or current path (without query string), or root
      const referer = req.get('Referer');
      const currentPath = req.originalUrl ? req.originalUrl.split('?')[0] : null;
      const redirectUrl = referer || currentPath || '/';
      logger.debug('Redirecting after validation failure', { redirectUrl });
      return res.redirect(redirectUrl);
    } else {
      return res.status(400).json({ errors: errors.array() });
    }
  }
  next();
}

/**
 * Middleware to parse and validate integer ID from route params
 * Converts req.params.id to integer and validates it's positive
 * Attaches parsed value to req.userId for use in route handlers
 */
function parseUserId(req, res, next) {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId < 1) {
    const error = new Error('Invalid user ID');
    error.status = 400;
    return next(error);
  }
  req.userId = userId;
  next();
}

module.exports = {
  validateRequest,
  parseUserId,
};
