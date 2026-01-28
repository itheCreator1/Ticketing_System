const { body, param } = require('express-validator');
const { MAX_LENGTHS, VALIDATION_MESSAGES } = require('../constants/validation');

/**
 * Validation rules for floor ID parameter
 */
const validateFloorId = [
  param('id')
    .isInt({ min: 1 }).withMessage(VALIDATION_MESSAGES.ID_INVALID)
];

/**
 * Validation rules for creating a floor
 */
const validateFloorCreate = [
  body('name')
    .trim()
    .notEmpty().withMessage('Floor name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Floor name must be 2-50 characters'),

  body('sort_order')
    .optional({ nullable: true, checkFalsy: false })
    .isInt({ min: 0 }).withMessage('Sort order must be 0 or greater')
    .toInt()
];

/**
 * Validation rules for updating a floor
 */
const validateFloorUpdate = [
  param('id')
    .isInt({ min: 1 }).withMessage(VALIDATION_MESSAGES.ID_INVALID),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Floor name must be 2-50 characters'),

  body('sort_order')
    .optional({ nullable: true, checkFalsy: false })
    .isInt({ min: 0 }).withMessage('Sort order must be 0 or greater')
    .toInt(),

  body('active')
    .optional()
    .isBoolean().withMessage('Active must be true or false')
    .toBoolean()
];

module.exports = {
  validateFloorId,
  validateFloorCreate,
  validateFloorUpdate
};
