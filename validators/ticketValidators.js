const { body, param } = require('express-validator');
const { TICKET_PRIORITY, TICKET_STATUS } = require('../constants/enums');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');

const validateTicketCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.TITLE_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_TITLE }).withMessage(VALIDATION_MESSAGES.TITLE_TOO_LONG),
  body('description')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_DESCRIPTION }).withMessage(VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  body('reporter_email')
    .isEmail().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .isLength({ max: MAX_LENGTHS.EMAIL }).withMessage(VALIDATION_MESSAGES.EMAIL_INVALID),
  body('reporter_name')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.NAME_REQUIRED)
    .isLength({ max: MAX_LENGTHS.NAME }).withMessage(VALIDATION_MESSAGES.NAME_TOO_LONG),
  body('reporter_phone')
    .optional()
    .trim()
    .isLength({ max: MAX_LENGTHS.PHONE_NUMBER }).withMessage(VALIDATION_MESSAGES.PHONE_TOO_LONG),
  body('priority').optional().isIn(Object.values(TICKET_PRIORITY)).withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID)
];

const validateTicketUpdate = [
  body('status').optional().isIn(Object.values(TICKET_STATUS)).withMessage(VALIDATION_MESSAGES.STATUS_INVALID),
  body('priority').optional().isIn(Object.values(TICKET_PRIORITY)).withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID)
];

const validateTicketId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Ticket ID must be a positive integer')
    .toInt()
];

const validateTicketAssignment = [
  body('assigned_to')
    .optional({ nullable: true })
    .custom((value) => {
      // Allow null or empty string (unassign)
      if (value === null || value === '') return true;
      // Otherwise must be a positive integer
      const parsed = parseInt(value);
      if (isNaN(parsed) || parsed < 1) {
        throw new Error('Assigned user ID must be a positive integer or null');
      }
      return true;
    })
];

module.exports = {
  validateTicketCreation,
  validateTicketUpdate,
  validateTicketId,
  validateTicketAssignment
};
