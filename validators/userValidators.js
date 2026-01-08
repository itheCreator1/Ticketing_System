const { body, param } = require('express-validator');
const { VALIDATION_MESSAGES } = require('../constants/validation');
const { USER_ROLE, USER_STATUS, REPORTER_DEPARTMENT } = require('../constants/enums');
const User = require('../models/User');
const { passwordValidation } = require('./shared/passwordRules');

const validateUserCreate = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage(VALIDATION_MESSAGES.USERNAME_INVALID)
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(VALIDATION_MESSAGES.USERNAME_INVALID)
    .custom(async (value) => {
      const existingUser = await User.findByUsername(value);
      if (existingUser) {
        throw new Error(VALIDATION_MESSAGES.USERNAME_IN_USE);
      }
      return true;
    }),

  body('email')
    .trim()
    .isEmail()
    .withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .normalizeEmail()
    .custom(async (value) => {
      const existingUser = await User.findByEmail(value);
      if (existingUser) {
        throw new Error(VALIDATION_MESSAGES.EMAIL_IN_USE);
      }
      return true;
    }),

  passwordValidation('password'),

  body('role')
    .isIn([USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.DEPARTMENT])
    .withMessage(VALIDATION_MESSAGES.ROLE_INVALID),

  body('department')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isIn(Object.values(REPORTER_DEPARTMENT))
    .withMessage('Invalid department selected')
];

const validateUserUpdate = [
  param('id').isInt().withMessage('Invalid user ID'),

  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage(VALIDATION_MESSAGES.USERNAME_INVALID)
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(VALIDATION_MESSAGES.USERNAME_INVALID),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .normalizeEmail(),

  body('role')
    .optional()
    .isIn([USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.DEPARTMENT])
    .withMessage(VALIDATION_MESSAGES.ROLE_INVALID),

  body('status')
    .optional()
    .isIn([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE])
    .withMessage('Invalid status'),

  body('department')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isIn(Object.values(REPORTER_DEPARTMENT))
    .withMessage('Invalid department selected')
];

const validatePasswordReset = [
  param('id').isInt().withMessage('Invalid user ID'),
  passwordValidation('password')
];

module.exports = {
  validateUserCreate,
  validateUserUpdate,
  validatePasswordReset
};
