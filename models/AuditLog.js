const pool = require('../config/database');
const logger = require('../utils/logger');

// Centralized action metadata — single source of truth for category and severity
const ACTION_METADATA = {
  USER_LOGIN: { category: 'authentication', severity: 'info' },
  USER_CREATED: { category: 'user_management', severity: 'info' },
  USER_UPDATED: { category: 'user_management', severity: 'warning' },
  USER_DELETED: { category: 'user_management', severity: 'critical' },
  PASSWORD_RESET: { category: 'user_management', severity: 'warning' },
  ASSIGN_USER_TO_DEPARTMENT: { category: 'user_management', severity: 'info' },
  REMOVE_USER_FROM_DEPARTMENT: { category: 'user_management', severity: 'warning' },
  TICKET_UPDATED: { category: 'ticket_management', severity: 'info' },
  CREATE_ADMIN_TICKET: { category: 'ticket_management', severity: 'info' },
  CREATE_DEPARTMENT_TICKET: { category: 'ticket_management', severity: 'info' },
  CREATE_DEPARTMENT: { category: 'department_management', severity: 'info' },
  UPDATE_DEPARTMENT: { category: 'department_management', severity: 'info' },
  DEACTIVATE_DEPARTMENT: { category: 'department_management', severity: 'critical' },
  REACTIVATE_DEPARTMENT: { category: 'department_management', severity: 'info' },
  FLOOR_CREATED: { category: 'floor_management', severity: 'info' },
  FLOOR_UPDATED: { category: 'floor_management', severity: 'info' },
  FLOOR_DEACTIVATED: { category: 'floor_management', severity: 'warning' },
  FLOOR_REACTIVATED: { category: 'floor_management', severity: 'info' },
  SEED_HOSPITAL_DATA: { category: 'system', severity: 'info' },
  SEED_SAMPLE_DATA: { category: 'system', severity: 'info' },
  AUDIT_LOG_VIEWED: { category: 'system', severity: 'info' },
  AUDIT_LOG_EXPORTED: { category: 'system', severity: 'warning' },
};

class AuditLog {
  static get ACTION_METADATA() {
    return ACTION_METADATA;
  }

  static _buildSearchText(action, targetType, targetId, details, actorUsername, ipAddress) {
    const parts = [
      (action || '').replace(/_/g, ' ').toLowerCase(),
      (targetType || '').toLowerCase(),
      targetId ? `#${targetId}` : '',
      (actorUsername || '').toLowerCase(),
      (ipAddress || '').toLowerCase(),
    ];
    if (details) {
      try {
        parts.push(JSON.stringify(details).substring(0, 200).toLowerCase());
      } catch {
        // ignore stringify errors
      }
    }
    return parts.filter(Boolean).join(' ');
  }

  static async create(
    {
      actorId,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
      actorUsername,
      actorRole,
      sessionHash,
      targetLabel,
    },
    client = null
  ) {
    const db = client || pool;
    const startTime = Date.now();

    // Auto-derive category and severity from centralized metadata
    const metadata = ACTION_METADATA[action] || { category: 'system', severity: 'info' };
    const actionCategory = metadata.category;
    const severity = metadata.severity;
    const searchText = AuditLog._buildSearchText(
      action,
      targetType,
      targetId,
      details,
      actorUsername,
      ipAddress
    );

    try {
      logger.debug('AuditLog.create: Creating audit log entry', {
        actorId,
        action,
        targetType,
        targetId,
        ipAddress,
        actionCategory,
        severity,
      });
      const result = await db.query(
        `INSERT INTO audit_logs
          (actor_id, action, target_type, target_id, details, ip_address,
           actor_username, actor_role, action_category, severity,
           target_label, session_hash, search_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          actorId,
          action,
          targetType,
          targetId,
          JSON.stringify(details),
          ipAddress,
          actorUsername || null,
          actorRole || null,
          actionCategory,
          severity,
          targetLabel || null,
          sessionHash || null,
          searchText,
        ]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('AuditLog.create: Slow query detected', {
          actorId,
          action,
          targetType,
          targetId,
          duration,
        });
      }

      logger.debug('AuditLog.create: Audit log created', {
        auditLogId: result.rows[0].id,
        actorId,
        action,
        targetType,
        targetId,
        duration,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('AuditLog.create: Database error', {
        actorId,
        action,
        targetType,
        targetId,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findByTarget(targetType, targetId, limit = 50) {
    const startTime = Date.now();
    try {
      logger.debug('AuditLog.findByTarget: Starting query', { targetType, targetId, limit });
      const result = await pool.query(
        'SELECT * FROM audit_logs WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT $3',
        [targetType, targetId, limit]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('AuditLog.findByTarget: Slow query detected', {
          targetType,
          targetId,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('AuditLog.findByTarget: Query completed', {
        targetType,
        targetId,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('AuditLog.findByTarget: Database error', {
        targetType,
        targetId,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findByActor(actorId, limit = 50) {
    const startTime = Date.now();
    try {
      logger.debug('AuditLog.findByActor: Starting query', { actorId, limit });
      const result = await pool.query(
        'SELECT * FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2',
        [actorId, limit]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('AuditLog.findByActor: Slow query detected', {
          actorId,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('AuditLog.findByActor: Query completed', {
        actorId,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('AuditLog.findByActor: Database error', {
        actorId,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }
  /**
   * Keyset-paginated query for the Log Explorer dashboard.
   * Always requires a time range (dateFrom/dateTo) for performance.
   */
  static async findWithCursor(filters = {}, cursor = null, limit = 50) {
    const startTime = Date.now();
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      // Always require time range (default enforced at route level)
      if (filters.dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }
      if (filters.dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      if (filters.action) {
        query += ` AND action = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }
      if (filters.actorId) {
        query += ` AND actor_id = $${paramIndex}`;
        params.push(filters.actorId);
        paramIndex++;
      }
      if (filters.targetType) {
        query += ` AND target_type = $${paramIndex}`;
        params.push(filters.targetType);
        paramIndex++;
      }
      if (filters.severity) {
        query += ` AND severity = $${paramIndex}`;
        params.push(filters.severity);
        paramIndex++;
      }
      if (filters.search) {
        query += ` AND search_text ILIKE $${paramIndex}`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      // Keyset cursor: (created_at, id) < ($cursorTime, $cursorId)
      if (cursor) {
        query += ` AND (created_at, id) < ($${paramIndex}, $${paramIndex + 1})`;
        params.push(cursor.created_at, cursor.id);
        paramIndex += 2;
      }

      query += ' ORDER BY created_at DESC, id DESC';
      query += ` LIMIT $${paramIndex}`;
      params.push(limit + 1); // Fetch one extra to detect "has more"

      logger.debug('AuditLog.findWithCursor: Executing query', { filters, cursor, limit });
      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      const hasMore = result.rows.length > limit;
      const logs = hasMore ? result.rows.slice(0, limit) : result.rows;
      const nextCursor =
        hasMore && logs.length > 0
          ? { created_at: logs[logs.length - 1].created_at, id: logs[logs.length - 1].id }
          : null;

      if (duration > 500) {
        logger.warn('AuditLog.findWithCursor: Slow query detected', {
          filters,
          duration,
          rowCount: logs.length,
        });
      }

      logger.debug('AuditLog.findWithCursor: Query completed', {
        rowCount: logs.length,
        hasMore,
        duration,
      });
      return { logs, nextCursor, hasMore };
    } catch (error) {
      logger.error('AuditLog.findWithCursor: Database error', {
        filters,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  /**
   * Chronological logs for a specific actor, used by User Timeline view.
   * Returns logs in ascending order (oldest first) for timeline display.
   */
  static async findByActorChronological(actorId, { dateFrom, dateTo, limit = 200 } = {}) {
    const startTime = Date.now();
    try {
      let query = 'SELECT * FROM audit_logs WHERE actor_id = $1';
      const params = [actorId];
      let paramIndex = 2;

      if (dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }
      if (dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }

      query += ` ORDER BY created_at ASC LIMIT $${paramIndex}`;
      params.push(limit);

      logger.debug('AuditLog.findByActorChronological: Starting query', {
        actorId,
        dateFrom,
        dateTo,
        limit,
      });
      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('AuditLog.findByActorChronological: Slow query detected', {
          actorId,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('AuditLog.findByActorChronological: Query completed', {
        actorId,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('AuditLog.findByActorChronological: Database error', {
        actorId,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  /**
   * Aggregate stats for a specific actor, used by User Timeline header.
   */
  static async getActorStats(actorId) {
    const startTime = Date.now();
    try {
      const result = await pool.query(
        `SELECT
          COUNT(*) AS total_actions,
          MIN(created_at) AS first_activity,
          MAX(created_at) AS last_activity
        FROM audit_logs
        WHERE actor_id = $1`,
        [actorId]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('AuditLog.getActorStats: Slow query detected', { actorId, duration });
      }

      const row = result.rows[0];
      return {
        totalActions: parseInt(row.total_actions, 10),
        firstActivity: row.first_activity,
        lastActivity: row.last_activity,
      };
    } catch (error) {
      logger.error('AuditLog.getActorStats: Database error', {
        actorId,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }
}

module.exports = AuditLog;
