const { body } = require('express-validator');
const { TICKET_PRIORITY, TICKET_STATUS, REPORTER_DEPARTMENT, REPORTER_DESK } = require('../constants/enums');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');

/**
 * Validator for department user ticket creation in client portal
 * Simpler than public form - department and desk are auto-filled from user account
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
  body('reporter_name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: MAX_LENGTHS.NAME }).withMessage(VALIDATION_MESSAGES.NAME_TOO_LONG),
  body('reporter_department')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.DEPARTMENT_REQUIRED)
    .isIn(Object.values(REPORTER_DEPARTMENT)).withMessage(VALIDATION_MESSAGES.DEPARTMENT_INVALID),
  body('reporter_desk')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.DESK_REQUIRED)
    .isIn(Object.values(REPORTER_DESK)).withMessage(VALIDATION_MESSAGES.DESK_INVALID),
  body('reporter_phone')
    .optional()
    .trim()
    .isLength({ max: MAX_LENGTHS.PHONE_NUMBER }).withMessage(VALIDATION_MESSAGES.PHONE_TOO_LONG),
  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY)).withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID)
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
