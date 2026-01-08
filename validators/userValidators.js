const { body, param } = require('express-validator');
const { VALIDATION_MESSAGES } = require('../constants/validation');
const { USER_ROLE, USER_STATUS } = require('../constants/enums');
const User = require('../models/User');
const Department = require('../models/Department');
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
    .custom(async (value, { req }) => {
      const role = req.body.role;
      const logger = require('../utils/logger');

      // Trim the value for validation
      const trimmedValue = value ? value.trim() : '';

      // If role is department, department must be provided and valid
      if (role === USER_ROLE.DEPARTMENT) {
        if (!trimmedValue) {
          throw new Error('Department is required for department role users');
        }

        // Fetch active departments from database (exclude system departments)
        const validDepartments = await Department.findAll(false);
        const validNames = validDepartments.map(d => d.name);

        logger.debug('Department validation', {
          role,
          department: trimmedValue,
          validDepartments: validNames
        });

        if (!validNames.includes(trimmedValue)) {
          throw new Error('Invalid department selected');
        }
      }

      // If role is not department, department should be empty (we'll convert to null in routes)
      if (role !== USER_ROLE.DEPARTMENT && trimmedValue) {
        throw new Error('Department can only be set for department role users');
      }

      return true;
    })
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
    .custom(async (value, { req }) => {
      const role = req.body.role;

      // Only validate if role is being updated
      if (role !== undefined) {
        // If role is department, department must be provided and valid
        if (role === USER_ROLE.DEPARTMENT) {
          if (!value) {
            throw new Error('Department is required for department role users');
          }

          // Fetch active departments from database (exclude system departments)
          const validDepartments = await Department.findAll(false);
          const validNames = validDepartments.map(d => d.name);

          if (!validNames.includes(value)) {
            throw new Error('Invalid department selected');
          }
        }

        // If role is not department, department should be null/empty
        if (role !== USER_ROLE.DEPARTMENT && value) {
          throw new Error('Department can only be set for department role users');
        }
      }

      // If role is not being updated, just validate department format if provided
      if (role === undefined && value) {
        // Fetch active departments from database (exclude system departments)
        const validDepartments = await Department.findAll(false);
        const validNames = validDepartments.map(d => d.name);

        if (!validNames.includes(value)) {
          throw new Error('Invalid department selected');
        }
      }

      return true;
    })
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
