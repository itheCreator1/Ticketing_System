const { body } = require('express-validator');
const { TICKET_PRIORITY, TICKET_STATUS, REPORTER_DEPARTMENT } = require('../constants/enums');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');

/**
 * Validator for department user ticket creation in client portal
 * Department and priority are auto-populated from user account/system
 * Department users only provide: title, description, and optional phone
 */
const validateClientTicketCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.TITLE_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_TITLE }).withMessage(VALIDATION_MESSAGES.TITLE_TOO_LONG),
  body('description')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_DESCRIPTION }).withMessage(VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  body('reporter_phone')
    .optional()
    .trim()
    .isLength({ max: MAX_LENGTHS.PHONE_NUMBER }).withMessage(VALIDATION_MESSAGES.PHONE_TOO_LONG)
];

/**
 * Validator for department user status updates
 * Only allows 'waiting_on_admin' and 'closed' statuses
 */
const validateClientStatusUpdate = [
  body('status')
    .trim()
    .notEmpty().withMessage('Status is required')
    .isIn(['waiting_on_admin', 'closed'])
    .withMessage('Department users can only set status to: waiting_on_admin, closed')
];

/**
 * Validator for department user comment creation
 * Department users can only create public comments (no visibility_type field)
 */
const validateClientCommentCreation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Comment cannot be empty')
    .isLength({ max: MAX_LENGTHS.COMMENT_CONTENT }).withMessage(VALIDATION_MESSAGES.COMMENT_TOO_LONG)
];

module.exports = {
  validateClientTicketCreation,
  validateClientStatusUpdate,
  validateClientCommentCreation
};
