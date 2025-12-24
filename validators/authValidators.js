const { body } = require('express-validator');
const { VALIDATION_MESSAGES } = require('../constants/validation');

const validateLogin = [
  body('username').trim().notEmpty().withMessage(VALIDATION_MESSAGES.USERNAME_REQUIRED),
  body('password').notEmpty().withMessage(VALIDATION_MESSAGES.PASSWORD_REQUIRED)
];

module.exports = {
  validateLogin
};
