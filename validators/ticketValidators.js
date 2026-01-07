const { body, param } = require('express-validator');
const { TICKET_PRIORITY, TICKET_STATUS } = require('../constants/enums');
const { VALIDATION_MESSAGES, MAX_LENGTHS } = require('../constants/validation');
const Department = require('../models/Department');

const validateTicketCreation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.TITLE_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_TITLE })
    .withMessage(VALIDATION_MESSAGES.TITLE_TOO_LONG),
  body('description')
    .trim()
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .isLength({ max: MAX_LENGTHS.TICKET_DESCRIPTION })
    .withMessage(VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  body('reporter_name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: MAX_LENGTHS.NAME })
    .withMessage(VALIDATION_MESSAGES.NAME_TOO_LONG),
  body('reporter_department')
    .trim()
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.DEPARTMENT_REQUIRED)
    .custom(async (value) => {
      const departments = await Department.findAll(true); // Include system departments
      const departmentNames = departments.map((d) => d.name);
      if (!departmentNames.includes(value)) {
        throw new Error(VALIDATION_MESSAGES.DEPARTMENT_INVALID);
      }
      return true;
    }),
  body('reporter_phone')
    .optional()
    .trim()
    .isLength({ max: MAX_LENGTHS.PHONE_NUMBER })
    .withMessage(VALIDATION_MESSAGES.PHONE_TOO_LONG),
  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID),
];

const validateTicketUpdate = [
  body('status')
    .optional()
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(VALIDATION_MESSAGES.STATUS_INVALID),
  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID),
];

const validateTicketId = [
  param('id').isInt({ min: 1 }).withMessage('Ticket ID must be a positive integer').toInt(),
];

const validateTicketAssignment = [
  body('assigned_to')
    .optional({ nullable: true })
    .custom((value) => {
      // Allow null or empty string (unassign)
      if (value === null || value === '') {
        return true;
      }
      // Otherwise must be a positive integer
      const parsed = parseInt(value);
      if (isNaN(parsed) || parsed < 1) {
        throw new Error('Assigned user ID must be a positive integer or null');
      }
      return true;
    }),
];

const validateTicketStatusUpdate = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(VALIDATION_MESSAGES.STATUS_INVALID),
];

const validateTicketPriorityUpdate = [
  body('priority')
    .trim()
    .notEmpty()
    .withMessage('Priority is required')
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID),
];

const validateBulkUpdate = [
  body('ticketIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Must select between 1 and 100 tickets'),
  body('ticketIds.*')
    .isInt({ min: 1 })
    .withMessage('Invalid ticket ID'),
  body('status')
    .optional({ checkFalsy: true })
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(VALIDATION_MESSAGES.STATUS_INVALID),
  body('priority')
    .optional({ checkFalsy: true })
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(VALIDATION_MESSAGES.PRIORITY_INVALID),
  body('assigned_to')
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (value === '__unassign__') return true; // Explicit unassignment sentinel
      return Number.isInteger(parseInt(value)) && parseInt(value) > 0;
    })
    .withMessage('Invalid user ID')
];

const validateQuickAssign = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ticket ID'),
  body('assigned_to')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Invalid user ID')
];

module.exports = {
  validateTicketCreation,
  validateTicketUpdate,
  validateTicketId,
  validateTicketAssignment,
  validateTicketStatusUpdate,
  validateTicketPriorityUpdate,
  validateBulkUpdate,
  validateQuickAssign,
};
