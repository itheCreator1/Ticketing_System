const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { auditLogLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validation');
const { validateAuditFilters, validateUserIdParam } = require('../validators/auditLogValidators');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  KNOWN_ACTIONS,
  ACTION_LABELS,
  ACTION_METADATA,
  eventSummary,
  actionColor,
  actionLabel,
  sanitizeDetailsForDisplay,
  removeFilterUrl,
  buildCursorUrl,
  decodeCursor,
  resolveDateRange,
  groupByDate,
  calculateDuration,
} = require('../utils/auditHelpers');

// All audit log routes require super_admin
router.use(requireAuth);
router.use(requireSuperAdmin);
router.use(auditLogLimiter);

/**
 * GET / — Log Explorer (main dashboard)
 */
router.get('/', validateAuditFilters, validateRequest, async (req, res, next) => {
  try {
    // Resolve date range
    const dateRange = req.query.dateRange || '7d';
    const { from: dateFrom, to: dateTo } = resolveDateRange(
      dateRange,
      req.query.dateFrom,
      req.query.dateTo
    );

    // Build filters
    const filters = {
      dateFrom,
      dateTo,
      action: req.query.action || null,
      actorId: req.query.actorId || null,
      targetType: req.query.targetType || null,
      severity: req.query.severity || null,
      search: req.query.search || null,
    };

    // Decode cursor for keyset pagination
    const cursor = decodeCursor(req.query.cursor);
    const limit = req.query.limit || 50;

    // Fetch logs
    const { logs, nextCursor, hasMore } = await AuditLog.findWithCursor(filters, cursor, limit);

    // Fetch users for filter dropdown
    const users = await User.findAllActive();

    // Log the dashboard access (audit-of-audit)
    const sessionHash = req.sessionID
      ? crypto.createHash('sha256').update(req.sessionID).digest('hex').substring(0, 16)
      : null;
    await AuditLog.create({
      actorId: req.session.user.id,
      action: 'AUDIT_LOG_VIEWED',
      targetType: 'audit_log',
      targetId: null,
      details: { filters: { dateRange, ...filters, dateFrom: undefined, dateTo: undefined } },
      ipAddress: req.ip,
      actorUsername: req.session.user.username,
      actorRole: req.session.user.role,
      sessionHash,
    });

    // Group actions by category for optgroup in filter dropdown
    const actionGroups = {};
    for (const action of KNOWN_ACTIONS) {
      const meta = ACTION_METADATA[action] || { category: 'system' };
      if (!actionGroups[meta.category]) {
        actionGroups[meta.category] = [];
      }
      actionGroups[meta.category].push({ value: action, label: ACTION_LABELS[action] || action });
    }

    // Build active filter chips
    const activeFilters = [];
    if (req.query.action) {
      activeFilters.push({
        label: actionLabel(req.query.action),
        param: 'action',
        removeUrl: removeFilterUrl(req.query, 'action'),
      });
    }
    if (req.query.actorId) {
      const actor = users.find((u) => u.id === parseInt(req.query.actorId));
      activeFilters.push({
        label: `User: ${actor ? actor.username : req.query.actorId}`,
        param: 'actorId',
        removeUrl: removeFilterUrl(req.query, 'actorId'),
      });
    }
    if (req.query.targetType) {
      activeFilters.push({
        label: `Target: ${req.query.targetType}`,
        param: 'targetType',
        removeUrl: removeFilterUrl(req.query, 'targetType'),
      });
    }
    if (req.query.severity) {
      activeFilters.push({
        label: `Severity: ${req.query.severity}`,
        param: 'severity',
        removeUrl: removeFilterUrl(req.query, 'severity'),
      });
    }
    if (req.query.search) {
      activeFilters.push({
        label: `Search: "${req.query.search}"`,
        param: 'search',
        removeUrl: removeFilterUrl(req.query, 'search'),
      });
    }

    const nextCursorUrl = hasMore ? buildCursorUrl(req.query, nextCursor) : null;

    res.render('admin/audit-logs/index', {
      title: req.t('audit:title'),
      t: req.t,
      language: req.language || 'el',
      logs,
      users,
      filters: req.query,
      dateRange,
      activeFilters,
      actionGroups,
      nextCursorUrl,
      hasMore,
      logCount: logs.length,
      // Helpers for the view
      eventSummary,
      actionColor,
      actionLabel,
      sanitizeDetailsForDisplay,
    });
  } catch (error) {
    logger.error('Audit log dashboard error', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /export — CSV export
 */
router.get('/export', validateAuditFilters, validateRequest, async (req, res, next) => {
  try {
    const dateRange = req.query.dateRange || '7d';
    const { from: dateFrom, to: dateTo } = resolveDateRange(
      dateRange,
      req.query.dateFrom,
      req.query.dateTo
    );

    const filters = {
      dateFrom,
      dateTo,
      action: req.query.action || null,
      actorId: req.query.actorId || null,
      targetType: req.query.targetType || null,
      severity: req.query.severity || null,
      search: req.query.search || null,
    };

    // Fetch up to 10,000 rows for export
    const { logs } = await AuditLog.findWithCursor(filters, null, 10000);

    if (logs.length === 0) {
      req.flash('error_msg', req.t('audit:csv.noData'));
      return res.redirect('/admin/audit-logs');
    }

    // Log the export (audit-of-audit)
    const sessionHash = req.sessionID
      ? crypto.createHash('sha256').update(req.sessionID).digest('hex').substring(0, 16)
      : null;
    await AuditLog.create({
      actorId: req.session.user.id,
      action: 'AUDIT_LOG_EXPORTED',
      targetType: 'audit_log',
      targetId: null,
      details: { rowCount: logs.length, filters: { dateRange } },
      ipAddress: req.ip,
      actorUsername: req.session.user.username,
      actorRole: req.session.user.role,
      sessionHash,
    });

    // Build CSV
    const csvHeaders = [
      'ID',
      'Timestamp',
      'User',
      'Role',
      'Action',
      'Category',
      'Severity',
      'Target Type',
      'Target ID',
      'IP Address',
      'Details',
    ];

    const csvRows = logs.map((log) => {
      const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
      return [
        log.id,
        new Date(log.created_at).toISOString(),
        log.actor_username || '',
        log.actor_role || '',
        log.action,
        log.action_category || '',
        log.severity || '',
        log.target_type || '',
        log.target_id || '',
        log.ip_address || '',
        `"${details}"`,
      ].join(',');
    });

    const csv = [csvHeaders.join(','), ...csvRows].join('\n');

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    logger.error('Audit log export error', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /user/:id — User Timeline
 */
router.get(
  '/user/:id',
  validateUserIdParam,
  validateRequest,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId) || userId < 1) {
        const error = new Error('Invalid user ID');
        error.status = 400;
        return next(error);
      }

      // Fetch user info
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        const error = new Error('User not found');
        error.status = 404;
        return next(error);
      }

      // Resolve date range for timeline
      let dateFrom, dateTo;
      const range = req.query.range || 'week';

      if (req.query.date) {
        // Specific date: show that full day
        const date = new Date(req.query.date);
        dateFrom = new Date(date);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(date);
        dateTo.setHours(23, 59, 59, 999);
      } else if (range === 'today') {
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date();
      } else if (range === 'week') {
        dateTo = new Date();
        dateFrom = new Date(dateTo - 7 * 24 * 60 * 60 * 1000);
      } else if (range === 'all') {
        dateFrom = undefined;
        dateTo = undefined;
      }

      // Fetch chronological logs
      const logs = await AuditLog.findByActorChronological(userId, {
        dateFrom,
        dateTo,
        limit: 200,
      });

      // Fetch actor stats
      const stats = await AuditLog.getActorStats(userId);

      // Group events by date for timeline display
      const groupedEvents = groupByDate(logs);

      res.render('admin/audit-logs/user-timeline', {
        title: req.t('audit:timeline.title', { username: targetUser.username }),
        t: req.t,
        language: req.language || 'el',
        targetUser,
        logs,
        stats,
        groupedEvents,
        range,
        currentDate: req.query.date || null,
        // Helpers
        eventSummary,
        actionColor,
        actionLabel,
        sanitizeDetailsForDisplay,
        calculateDuration,
      });
    } catch (error) {
      logger.error('User timeline error', {
        error: error.message,
        stack: error.stack,
        userId: req.params.id,
      });
      next(error);
    }
  }
);

module.exports = router;
