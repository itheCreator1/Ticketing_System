const { body } = require('express-validator');
const { COMMENT_VISIBILITY } = require('../constants/enums');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');

const validateCommentCreation = [
  body('content')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.COMMENT_REQUIRED)
    .isLength({ max: MAX_LENGTHS.COMMENT_CONTENT }).withMessage(VALIDATION_MESSAGES.COMMENT_TOO_LONG),
  body('visibility_type')
    .optional()
    .isIn(Object.values(COMMENT_VISIBILITY))
    .withMessage('Invalid comment visibility type')
];

module.exports = {
  validateCommentCreation
};
