const { body, param } = require('express-validator');
const { MAX_LENGTHS, VALIDATION_MESSAGES } = require('../constants/validation');

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
    .withMessage('Description must be less than 500 characters')
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

module.exports = {
  validateDepartmentCreate,
  validateDepartmentUpdate,
  validateDepartmentId
};
