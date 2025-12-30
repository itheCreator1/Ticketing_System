const pool = require('../config/database');
const logger = require('../utils/logger');

class AuditLog {
  static async create({ actorId, action, targetType, targetId, details, ipAddress }) {
    const startTime = Date.now();
    try {
      logger.debug('AuditLog.create: Creating audit log entry', { actorId, action, targetType, targetId, ipAddress });
      const result = await pool.query(
        'INSERT INTO audit_logs (actor_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [actorId, action, targetType, targetId, JSON.stringify(details), ipAddress]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('AuditLog.create: Slow query detected', { actorId, action, targetType, targetId, duration });
      }

      logger.debug('AuditLog.create: Audit log created', { auditLogId: result.rows[0].id, actorId, action, targetType, targetId, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('AuditLog.create: Database error', {
        actorId,
        action,
        targetType,
        targetId,
        error: error.message,
        stack: error.stack,
        code: error.code
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
        logger.warn('AuditLog.findByTarget: Slow query detected', { targetType, targetId, duration, rowCount: result.rows.length });
      }

      logger.debug('AuditLog.findByTarget: Query completed', { targetType, targetId, rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('AuditLog.findByTarget: Database error', {
        targetType,
        targetId,
        error: error.message,
        stack: error.stack,
        code: error.code
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
        logger.warn('AuditLog.findByActor: Slow query detected', { actorId, duration, rowCount: result.rows.length });
      }

      logger.debug('AuditLog.findByActor: Query completed', { actorId, rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('AuditLog.findByActor: Database error', {
        actorId,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }
}

module.exports = AuditLog;
