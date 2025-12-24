const { body } = require('express-validator');
const { VALIDATION_MESSAGES } = require('../constants/validation');

const validateCommentCreation = [
  body('content').trim().notEmpty().withMessage(VALIDATION_MESSAGES.COMMENT_REQUIRED)
];

module.exports = {
  validateCommentCreation
};
