const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.accepts('html')) {
      errors.array().forEach(error => {
        req.flash('error_msg', error.msg);
      });
      return res.redirect('back');
    } else {
      return res.status(400).json({ errors: errors.array() });
    }
  }
  next();
}

module.exports = {
  validateRequest
};
