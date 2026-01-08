const { body } = require('express-validator');
const { TICKET_PRIORITY, TICKET_STATUS } = require('../constants/enums');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');
const Department = require('../models/Department');

/**
 * Validator for admin ticket creation
 * Admins can select any department (not forced to 'Internal')
 * Admins can set priority and status at creation (unlike department users)
 * Visibility is controlled by is_admin_created flag, not department value
 */
const validateAdminTicketCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.TITLE_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_TITLE }).withMessage(VALIDATION_MESSAGES.TITLE_TOO_LONG),

  body('description')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_DESCRIPTION }).withMessage(VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),

  body('reporter_department')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.DEPARTMENT_REQUIRED)
    .custom(async (value) => {
      // Fetch all departments including system ('Internal')
      const validDepartments = await Department.findAll(true);
      const validNames = validDepartments.map(d => d.name);

      if (!validNames.includes(value)) {
        throw new Error(VALIDATION_MESSAGES.DEPARTMENT_INVALID);
      }
      return true;
    }),

  body('reporter_phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: MAX_LENGTHS.PHONE_NUMBER }).withMessage(VALIDATION_MESSAGES.PHONE_TOO_LONG),

  // Admins can optionally set priority (defaults to 'unset' if not provided)
  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY)).withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID),

  // Status always defaults to 'open' for new tickets
  body('status')
    .optional()
    .isIn(Object.values(TICKET_STATUS)).withMessage(VALIDATION_MESSAGES.STATUS_INVALID)
];

module.exports = {
  validateAdminTicketCreation
};
