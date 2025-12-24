const pool = require('../config/database');

class AuditLog {
  static async create({ actorId, action, targetType, targetId, details, ipAddress }) {
    const result = await pool.query(
      'INSERT INTO audit_logs (actor_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [actorId, action, targetType, targetId, JSON.stringify(details), ipAddress]
    );
    return result.rows[0];
  }

  static async findByTarget(targetType, targetId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM audit_logs WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT $3',
      [targetType, targetId, limit]
    );
    return result.rows;
  }

  static async findByActor(actorId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2',
      [actorId, limit]
    );
    return result.rows;
  }
}

module.exports = AuditLog;
