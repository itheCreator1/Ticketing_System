const { body } = require('express-validator');
const { TICKET_PRIORITY, TICKET_STATUS } = require('../constants/enums');
const { VALIDATION_MESSAGES } = require('../constants/validation');

const validateTicketCreation = [
  body('title').trim().notEmpty().withMessage(VALIDATION_MESSAGES.TITLE_REQUIRED),
  body('description').trim().notEmpty().withMessage(VALIDATION_MESSAGES.DESCRIPTION_REQUIRED),
  body('reporter_email').isEmail().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID),
  body('reporter_name').trim().notEmpty().withMessage(VALIDATION_MESSAGES.NAME_REQUIRED),
  body('priority').isIn(Object.values(TICKET_PRIORITY)).withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID)
];

const validateTicketUpdate = [
  body('status').optional().isIn(Object.values(TICKET_STATUS)).withMessage(VALIDATION_MESSAGES.STATUS_INVALID),
  body('priority').optional().isIn(Object.values(TICKET_PRIORITY)).withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID)
];

module.exports = {
  validateTicketCreation,
  validateTicketUpdate
};
