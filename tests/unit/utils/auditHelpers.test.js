/**
 * Unit Tests for Audit Log Helper Functions
 *
 * Tests pure functions used by the audit log dashboard: event summaries,
 * action metadata, date grouping, detail sanitization, URL building, etc.
 */

const {
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
} = require('../../../utils/auditHelpers');

describe('auditHelpers', () => {
  describe('ACTION_METADATA', () => {
    it('should have metadata for all known actions', () => {
      expect(Object.keys(ACTION_METADATA).length).toBeGreaterThanOrEqual(20);
    });

    it('should have category and severity for each action', () => {
      Object.entries(ACTION_METADATA).forEach(([_action, meta]) => {
        expect(meta).toHaveProperty('category');
        expect(meta).toHaveProperty('severity');
        expect(['info', 'warning', 'critical']).toContain(meta.severity);
      });
    });

    it('should categorize USER_LOGIN as authentication', () => {
      expect(ACTION_METADATA.USER_LOGIN.category).toBe('authentication');
      expect(ACTION_METADATA.USER_LOGIN.severity).toBe('info');
    });

    it('should categorize USER_DELETED as critical', () => {
      expect(ACTION_METADATA.USER_DELETED.severity).toBe('critical');
    });

    it('should categorize DEACTIVATE_DEPARTMENT as critical', () => {
      expect(ACTION_METADATA.DEACTIVATE_DEPARTMENT.severity).toBe('critical');
    });
  });

  describe('ACTION_COLORS', () => {
    it('should have a color for each known action', () => {
      KNOWN_ACTIONS.forEach((action) => {
        expect(ACTION_COLORS).toHaveProperty(action);
      });
    });

    it('should use danger for delete/deactivate actions', () => {
      expect(ACTION_COLORS.USER_DELETED).toBe('danger');
      expect(ACTION_COLORS.DEACTIVATE_DEPARTMENT).toBe('danger');
    });

    it('should use success for create actions', () => {
      expect(ACTION_COLORS.USER_CREATED).toBe('success');
      expect(ACTION_COLORS.CREATE_DEPARTMENT).toBe('success');
    });
  });

  describe('ACTION_LABELS', () => {
    it('should have a label for each known action', () => {
      KNOWN_ACTIONS.forEach((action) => {
        expect(ACTION_LABELS).toHaveProperty(action);
        expect(typeof ACTION_LABELS[action]).toBe('string');
      });
    });

    it('should return human-readable labels', () => {
      expect(ACTION_LABELS.USER_LOGIN).toBe('User Login');
      expect(ACTION_LABELS.TICKET_UPDATED).toBe('Ticket Updated');
    });
  });

  describe('KNOWN_ACTIONS', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(KNOWN_ACTIONS)).toBe(true);
      KNOWN_ACTIONS.forEach((action) => {
        expect(typeof action).toBe('string');
      });
    });

    it('should contain core action types', () => {
      expect(KNOWN_ACTIONS).toContain('USER_LOGIN');
      expect(KNOWN_ACTIONS).toContain('USER_CREATED');
      expect(KNOWN_ACTIONS).toContain('TICKET_UPDATED');
      expect(KNOWN_ACTIONS).toContain('CREATE_DEPARTMENT');
    });
  });

  describe('eventSummary', () => {
    it('should generate login summary with IP', () => {
      const event = { action: 'USER_LOGIN', ip_address: '192.168.1.1' };
      expect(eventSummary(event)).toBe('Logged in from 192.168.1.1');
    });

    it('should generate login summary without IP', () => {
      const event = { action: 'USER_LOGIN', ip_address: null };
      expect(eventSummary(event)).toBe('Logged in from unknown');
    });

    it('should generate user created summary with target', () => {
      const event = { action: 'USER_CREATED', target_type: 'user', target_id: 5 };
      expect(eventSummary(event)).toBe('Created user user #5');
    });

    it('should generate ticket updated summary', () => {
      const event = { action: 'TICKET_UPDATED', target_type: 'ticket', target_id: 42 };
      expect(eventSummary(event)).toBe('Updated ticket ticket #42');
    });

    it('should generate department created summary', () => {
      const event = { action: 'CREATE_DEPARTMENT', target_type: 'department', target_id: 3 };
      expect(eventSummary(event)).toBe('Created department department #3');
    });

    it('should handle unknown actions gracefully', () => {
      const event = { action: 'UNKNOWN_ACTION', target_type: 'widget', target_id: 1 };
      const result = eventSummary(event);
      expect(result).toContain('UNKNOWN_ACTION');
    });

    it('should handle events without target', () => {
      const event = { action: 'AUDIT_LOG_VIEWED' };
      expect(eventSummary(event)).toBe('Viewed audit logs');
    });
  });

  describe('actionColor', () => {
    it('should return the correct color for known actions', () => {
      expect(actionColor('USER_LOGIN')).toBe('info');
      expect(actionColor('USER_DELETED')).toBe('danger');
      expect(actionColor('USER_CREATED')).toBe('success');
    });

    it('should return light for unknown actions', () => {
      expect(actionColor('UNKNOWN_ACTION')).toBe('light');
    });
  });

  describe('actionLabel', () => {
    it('should return the correct label for known actions', () => {
      expect(actionLabel('USER_LOGIN')).toBe('User Login');
      expect(actionLabel('TICKET_UPDATED')).toBe('Ticket Updated');
    });

    it('should convert underscores to spaces for unknown actions', () => {
      expect(actionLabel('UNKNOWN_ACTION')).toBe('UNKNOWN ACTION');
    });
  });

  describe('groupByDate', () => {
    it('should group events by calendar date', () => {
      const events = [
        { created_at: '2026-02-25T10:00:00Z' },
        { created_at: '2026-02-25T14:00:00Z' },
        { created_at: '2026-02-24T09:00:00Z' },
      ];
      const grouped = groupByDate(events);
      const keys = Object.keys(grouped);

      expect(keys.length).toBe(2);
      expect(grouped['2026-02-25'].length).toBe(2);
      expect(grouped['2026-02-24'].length).toBe(1);
    });

    it('should sort keys in reverse chronological order', () => {
      const events = [
        { created_at: '2026-02-23T10:00:00Z' },
        { created_at: '2026-02-25T10:00:00Z' },
        { created_at: '2026-02-24T10:00:00Z' },
      ];
      const grouped = groupByDate(events);
      const keys = Object.keys(grouped);

      expect(keys[0]).toBe('2026-02-25');
      expect(keys[1]).toBe('2026-02-24');
      expect(keys[2]).toBe('2026-02-23');
    });

    it('should return empty object for empty array', () => {
      expect(groupByDate([])).toEqual({});
    });

    it('should handle single event', () => {
      const events = [{ created_at: '2026-02-25T10:00:00Z' }];
      const grouped = groupByDate(events);
      expect(Object.keys(grouped).length).toBe(1);
      expect(grouped['2026-02-25'].length).toBe(1);
    });
  });

  describe('calculateDuration', () => {
    it('should return hours and minutes for long durations', () => {
      const start = '2026-02-25T10:00:00Z';
      const end = '2026-02-25T12:30:00Z';
      expect(calculateDuration(start, end)).toBe('2h 30m');
    });

    it('should return only minutes for short durations', () => {
      const start = '2026-02-25T10:00:00Z';
      const end = '2026-02-25T10:45:00Z';
      expect(calculateDuration(start, end)).toBe('45m');
    });

    it('should return < 1m for very short durations', () => {
      const start = '2026-02-25T10:00:00Z';
      const end = '2026-02-25T10:00:30Z';
      expect(calculateDuration(start, end)).toBe('< 1m');
    });

    it('should handle same start and end', () => {
      const time = '2026-02-25T10:00:00Z';
      expect(calculateDuration(time, time)).toBe('< 1m');
    });

    it('should handle exact hour durations', () => {
      const start = '2026-02-25T10:00:00Z';
      const end = '2026-02-25T13:00:00Z';
      expect(calculateDuration(start, end)).toBe('3h 0m');
    });
  });

  describe('sanitizeDetailsForDisplay', () => {
    it('should strip password fields', () => {
      const details = { username: 'admin', password: 'secret123' };
      const result = sanitizeDetailsForDisplay(details);
      expect(result.username).toBe('admin');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should strip password_hash fields', () => {
      const details = { password_hash: '$2b$10$abc123' };
      const result = sanitizeDetailsForDisplay(details);
      expect(result.password_hash).toBe('[REDACTED]');
    });

    it('should strip token fields', () => {
      const details = { access_token: 'abc123', name: 'test' };
      const result = sanitizeDetailsForDisplay(details);
      expect(result.access_token).toBe('[REDACTED]');
      expect(result.name).toBe('test');
    });

    it('should strip secret fields', () => {
      const details = { client_secret: 'xyz', id: 1 };
      const result = sanitizeDetailsForDisplay(details);
      expect(result.client_secret).toBe('[REDACTED]');
      expect(result.id).toBe(1);
    });

    it('should strip session fields', () => {
      const details = { session_id: 'abc', action: 'login' };
      const result = sanitizeDetailsForDisplay(details);
      expect(result.session_id).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const details = { user: { password: 'secret', name: 'admin' } };
      const result = sanitizeDetailsForDisplay(details);
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.user.name).toBe('admin');
    });

    it('should return null/undefined as-is', () => {
      expect(sanitizeDetailsForDisplay(null)).toBe(null);
      expect(sanitizeDetailsForDisplay(undefined)).toBe(undefined);
    });

    it('should handle non-object values', () => {
      expect(sanitizeDetailsForDisplay('string')).toBe('string');
      expect(sanitizeDetailsForDisplay(123)).toBe(123);
    });

    it('should preserve safe fields', () => {
      const details = { status: 'active', priority: 'high', assigned_to: 5 };
      const result = sanitizeDetailsForDisplay(details);
      expect(result).toEqual(details);
    });
  });

  describe('removeFilterUrl', () => {
    it('should remove a specific filter parameter', () => {
      const query = { action: 'USER_LOGIN', severity: 'info', dateRange: '7d' };
      const result = removeFilterUrl(query, 'action');
      expect(result).not.toContain('action=');
      expect(result).toContain('severity=info');
      expect(result).toContain('dateRange=7d');
    });

    it('should also remove cursor when removing a filter', () => {
      const query = { action: 'USER_LOGIN', cursor: 'abc123' };
      const result = removeFilterUrl(query, 'action');
      expect(result).not.toContain('action=');
      expect(result).not.toContain('cursor=');
    });

    it('should return empty string when all params removed', () => {
      const query = { action: 'USER_LOGIN' };
      const result = removeFilterUrl(query, 'action');
      expect(result).toBe('');
    });
  });

  describe('buildCursorUrl', () => {
    it('should add cursor parameter as base64url', () => {
      const query = { dateRange: '7d' };
      const cursor = { created_at: '2026-02-25T10:00:00Z', id: 100 };
      const result = buildCursorUrl(query, cursor);
      expect(result).toContain('cursor=');
      expect(result).toContain('dateRange=7d');
    });

    it('should remove cursor when cursor is null', () => {
      const query = { dateRange: '7d', cursor: 'old' };
      const result = buildCursorUrl(query, null);
      expect(result).not.toContain('cursor=');
      expect(result).toContain('dateRange=7d');
    });
  });

  describe('decodeCursor', () => {
    it('should decode a valid base64url cursor', () => {
      const original = { created_at: '2026-02-25T10:00:00Z', id: 100 };
      const encoded = Buffer.from(JSON.stringify(original)).toString('base64url');
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual(original);
    });

    it('should return null for invalid cursor', () => {
      expect(decodeCursor('not-valid-base64')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(decodeCursor(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(decodeCursor(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decodeCursor('')).toBeNull();
    });
  });

  describe('resolveDateRange', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-25T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve "today" to start of day until now', () => {
      const { from, to } = resolveDateRange('today');
      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);
      expect(to.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should resolve "24h" to 24 hours ago', () => {
      const { from, to } = resolveDateRange('24h');
      const diff = to - from;
      expect(diff).toBe(24 * 60 * 60 * 1000);
    });

    it('should resolve "7d" to 7 days ago', () => {
      const { from, to } = resolveDateRange('7d');
      const diff = to - from;
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should resolve "30d" to 30 days ago', () => {
      const { from, to } = resolveDateRange('30d');
      const diff = to - from;
      expect(diff).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should resolve "90d" to 90 days ago', () => {
      const { from, to } = resolveDateRange('90d');
      const diff = to - from;
      expect(diff).toBe(90 * 24 * 60 * 60 * 1000);
    });

    it('should resolve "custom" with provided dates', () => {
      const { from, to } = resolveDateRange('custom', '2026-01-01', '2026-02-01');
      expect(from.toISOString().split('T')[0]).toBe('2026-01-01');
      expect(to.toISOString().split('T')[0]).toBe('2026-02-01');
    });

    it('should default to 7d for unknown preset', () => {
      const { from, to } = resolveDateRange('invalid');
      const diff = to - from;
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should default custom range to 7d when no dates provided', () => {
      const { from, to } = resolveDateRange('custom');
      const diff = to - from;
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
