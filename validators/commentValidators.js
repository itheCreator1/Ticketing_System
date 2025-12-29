const { body } = require('express-validator');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');

const validateCommentCreation = [
  body('content')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.COMMENT_REQUIRED)
    .isLength({ max: MAX_LENGTHS.COMMENT_CONTENT }).withMessage(VALIDATION_MESSAGES.COMMENT_TOO_LONG)
];

module.exports = {
  validateCommentCreation
};
