const { body, param } = require('express-validator');
const { MAX_LENGTHS, VALIDATION_MESSAGES } = require('../constants/validation');
const Floor = require('../models/Floor');

/**
 * Validation rules for creating a department
 */
const validateDepartmentCreate = [
  body('name')
    .trim()
    .notEmpty().withMessage('Department name is required')
    .isLength({ min: 2, max: MAX_LENGTHS.DEPARTMENT })
    .withMessage(`Department name must be 2-${MAX_LENGTHS.DEPARTMENT} characters`),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),

  body('floor')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.FLOOR_REQUIRED)
    .custom(async (value) => {
      const floors = await Floor.findAll(true); // Include system floors
      const floorNames = floors.map(f => f.name);
      if (!floorNames.includes(value)) {
        throw new Error(VALIDATION_MESSAGES.FLOOR_INVALID);
      }
      return true;
    })
];

/**
 * Validation rules for updating a department
 */
const validateDepartmentUpdate = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid department ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: MAX_LENGTHS.DEPARTMENT })
    .withMessage(`Department name must be 2-${MAX_LENGTHS.DEPARTMENT} characters`),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),

  body('floor')
    .optional()
    .trim()
    .custom(async (value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Optional field can be empty
      }
      const floors = await Floor.findAll(true); // Include system floors
      const floorNames = floors.map(f => f.name);
      if (!floorNames.includes(value)) {
        throw new Error(VALIDATION_MESSAGES.FLOOR_INVALID);
      }
      return true;
    }),

  body('active')
    .optional()
    .isBoolean().withMessage('Active must be boolean')
];

/**
 * Validation rules for department ID parameter
 */
const validateDepartmentId = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid department ID')
];

/**
 * Validation rules for user assignment to department
 */
const validateUserAssignment = [
  body('user_id')
    .trim()
    .notEmpty().withMessage('User is required')
    .isInt({ min: 1 }).withMessage('Invalid user ID')
    .toInt()
];

module.exports = {
  validateDepartmentCreate,
  validateDepartmentUpdate,
  validateDepartmentId,
  validateUserAssignment
};
