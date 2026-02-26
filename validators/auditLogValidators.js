const { query } = require('express-validator');
const { KNOWN_ACTIONS } = require('../utils/auditHelpers');
const { sanitizeSearchInput } = require('../utils/sanitizeSearch');

const validateAuditFilters = [
  query('action')
    .optional()
    .isIn(KNOWN_ACTIONS)
    .withMessage('Invalid action type'),
  query('actorId')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Actor ID must be a positive integer'),
  query('targetType')
    .optional()
    .isIn(['user', 'ticket', 'comment', 'department', 'floor', 'system', 'audit_log'])
    .withMessage('Invalid target type'),
  query('severity')
    .optional()
    .isIn(['info', 'warning', 'critical'])
    .withMessage('Invalid severity level'),
  query('dateRange')
    .optional()
    .isIn(['today', '24h', '7d', '30d', '90d', 'custom'])
    .withMessage('Invalid date range preset'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid start date format'),
  query('dateTo')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid end date format'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long (max 100 characters)')
    .customSanitizer((value) => sanitizeSearchInput(value)),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('cursor')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Invalid cursor'),
];

const validateUserIdParam = [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  query('range')
    .optional()
    .isIn(['today', 'week', 'all'])
    .withMessage('Invalid range value'),
];

module.exports = {
  validateAuditFilters,
  validateUserIdParam,
};
