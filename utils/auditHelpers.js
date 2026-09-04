const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

const ACTION_METADATA = AuditLog.ACTION_METADATA;

// Color mapping for action badges
const ACTION_COLORS = {
  USER_LOGIN: 'info',
  USER_CREATED: 'success',
  USER_UPDATED: 'warning',
  USER_DELETED: 'danger',
  PASSWORD_RESET: 'secondary',
  ASSIGN_USER_TO_DEPARTMENT: 'info',
  REMOVE_USER_FROM_DEPARTMENT: 'warning',
  TICKET_UPDATED: 'warning',
  CREATE_ADMIN_TICKET: 'success',
  CREATE_DEPARTMENT_TICKET: 'success',
  TICKET_CREATED: 'success',
  COMMENT_CREATED: 'info',
  CREATE_DEPARTMENT: 'success',
  UPDATE_DEPARTMENT: 'warning',
  DEACTIVATE_DEPARTMENT: 'danger',
  REACTIVATE_DEPARTMENT: 'success',
  FLOOR_CREATED: 'success',
  FLOOR_UPDATED: 'warning',
  FLOOR_DEACTIVATED: 'danger',
  FLOOR_REACTIVATED: 'success',
  AUDIT_LOG_VIEWED: 'secondary',
  AUDIT_LOG_EXPORTED: 'secondary',
};

// Human-readable labels for actions
const ACTION_LABELS = {
  USER_LOGIN: 'User Login',
  USER_CREATED: 'User Created',
  USER_UPDATED: 'User Updated',
  USER_DELETED: 'User Deleted',
  PASSWORD_RESET: 'Password Reset',
  ASSIGN_USER_TO_DEPARTMENT: 'Assigned to Dept',
  REMOVE_USER_FROM_DEPARTMENT: 'Removed from Dept',
  TICKET_UPDATED: 'Ticket Updated',
  CREATE_ADMIN_TICKET: 'Admin Ticket Created',
  CREATE_DEPARTMENT_TICKET: 'Dept Ticket Created',
  TICKET_CREATED: 'Ticket Created',
  COMMENT_CREATED: 'Comment Added',
  CREATE_DEPARTMENT: 'Department Created',
  UPDATE_DEPARTMENT: 'Department Updated',
  DEACTIVATE_DEPARTMENT: 'Department Deactivated',
  REACTIVATE_DEPARTMENT: 'Department Reactivated',
  FLOOR_CREATED: 'Floor Created',
  FLOOR_UPDATED: 'Floor Updated',
  FLOOR_DEACTIVATED: 'Floor Deactivated',
  FLOOR_REACTIVATED: 'Floor Reactivated',
  AUDIT_LOG_VIEWED: 'Audit Log Viewed',
  AUDIT_LOG_EXPORTED: 'Audit Log Exported',
};

// Known action types for validation whitelist
const KNOWN_ACTIONS = Object.keys(ACTION_METADATA);

// Sensitive keys to strip from details before display
const SENSITIVE_KEYS = ['password', 'password_hash', 'token', 'secret', 'session', 'hash'];

/**
 * Human-readable one-liner for an audit event.
 */
function eventSummary(event) {
  const target = event.target_type ? `${event.target_type} #${event.target_id}` : '';

  const summaries = {
    USER_LOGIN: `Logged in from ${event.ip_address || 'unknown'}`,
    USER_CREATED: `Created user ${target}`,
    USER_UPDATED: `Updated user ${target}`,
    USER_DELETED: `Deleted user ${target}`,
    PASSWORD_RESET: `Reset password for user ${target}`,
    ASSIGN_USER_TO_DEPARTMENT: `Assigned user ${target} to department`,
    REMOVE_USER_FROM_DEPARTMENT: `Removed user ${target} from department`,
    TICKET_UPDATED: `Updated ticket ${target}`,
    CREATE_ADMIN_TICKET: `Created internal admin ticket ${target}`,
    CREATE_DEPARTMENT_TICKET: `Created department ticket ${target}`,
    TICKET_CREATED: `Created ticket ${target}`,
    COMMENT_CREATED: `Added comment on ticket ${target}`,
    CREATE_DEPARTMENT: `Created department ${target}`,
    UPDATE_DEPARTMENT: `Updated department ${target}`,
    DEACTIVATE_DEPARTMENT: `Deactivated department ${target}`,
    REACTIVATE_DEPARTMENT: `Reactivated department ${target}`,
    FLOOR_CREATED: `Created floor ${target}`,
    FLOOR_UPDATED: `Updated floor ${target}`,
    FLOOR_DEACTIVATED: `Deactivated floor ${target}`,
    FLOOR_REACTIVATED: `Reactivated floor ${target}`,
    AUDIT_LOG_VIEWED: 'Viewed audit logs',
    AUDIT_LOG_EXPORTED: 'Exported audit logs',
  };

  return summaries[event.action] || `${event.action} on ${target}`;
}

/**
 * Returns badge color for an action type.
 */
function actionColor(action) {
  return ACTION_COLORS[action] || 'light';
}

/**
 * Returns human-readable label for an action type.
 */
function actionLabel(action) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

/**
 * Groups an array of events by calendar date.
 * Returns an object: { '2026-02-25': [...events], '2026-02-24': [...events] }
 * Keys are sorted in reverse chronological order.
 */
function groupByDate(events) {
  const groups = {};
  for (const event of events) {
    const date = new Date(event.created_at).toISOString().split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
  }

  // Sort keys reverse chronologically
  const sorted = {};
  const keys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  for (const key of keys) {
    sorted[key] = groups[key];
  }
  return sorted;
}

/**
 * Calculate duration between two timestamps as a readable string.
 */
function calculateDuration(start, end) {
  const diffMs = new Date(end) - new Date(start);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
}

/**
 * Strip sensitive fields from details JSONB before rendering.
 */
function sanitizeDetailsForDisplay(details) {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetailsForDisplay(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Rebuild a URL query string without a specific parameter.
 */
function removeFilterUrl(query, paramToRemove) {
  const params = new URLSearchParams(query);
  params.delete(paramToRemove);
  // Also reset cursor when filters change
  params.delete('cursor');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Build a URL with cursor parameter for keyset pagination.
 */
function buildCursorUrl(query, cursor) {
  const params = new URLSearchParams(query);
  if (cursor) {
    params.set('cursor', Buffer.from(JSON.stringify(cursor)).toString('base64url'));
  } else {
    params.delete('cursor');
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Decode a cursor from base64url string.
 */
function decodeCursor(cursorStr) {
  if (!cursorStr) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(cursorStr, 'base64url').toString());
  } catch {
    return null;
  }
}

/**
 * Convert a date range preset to actual from/to dates.
 */
function resolveDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      return { from: startOfDay, to: now };
    case '24h':
      return { from: new Date(now - 24 * 60 * 60 * 1000), to: now };
    case '7d':
      return { from: new Date(now - 7 * 24 * 60 * 60 * 1000), to: now };
    case '30d':
      return { from: new Date(now - 30 * 24 * 60 * 60 * 1000), to: now };
    case '90d':
      return { from: new Date(now - 90 * 24 * 60 * 60 * 1000), to: now };
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom) : new Date(now - 7 * 24 * 60 * 60 * 1000),
        to: customTo ? new Date(customTo) : now,
      };
    default:
      return { from: new Date(now - 7 * 24 * 60 * 60 * 1000), to: now };
  }
}

/**
 * Build auditContext from an Express request.
 * Centralizes session hash computation so routes don't duplicate crypto calls.
 */
function buildAuditContext(req) {
  return {
    actorUsername: req.session.user.username,
    actorRole: req.session.user.role,
    sessionHash: req.sessionID
      ? crypto.createHash('sha256').update(req.sessionID).digest('hex').substring(0, 16)
      : null,
  };
}

module.exports = {
  ACTION_METADATA,
  ACTION_COLORS,
  ACTION_LABELS,
  KNOWN_ACTIONS,
  eventSummary,
  actionColor,
  actionLabel,
  groupByDate,
  calculateDuration,
  sanitizeDetailsForDisplay,
  removeFilterUrl,
  buildCursorUrl,
  decodeCursor,
  resolveDateRange,
  buildAuditContext,
};
