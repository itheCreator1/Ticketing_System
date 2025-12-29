const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async findById(id) {
    const result = await pool.query(
      'SELECT id, username, email, role, status, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  }

  static async create({ username, email, password, role = 'admin' }) {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, password_hash, role]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query(
      'SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  }

  // Update user fields (excluding password)
  static async update(id, { username, email, role, status }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (username !== undefined) {
      fields.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(status);
      if (status === 'deleted') {
        fields.push(`deleted_at = CURRENT_TIMESTAMP`);
      }
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, role, status, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Update password (admin-initiated, no verification)
  static async updatePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [password_hash, id]
    );
    return result.rows[0];
  }

  // Soft delete user
  static async softDelete(id) {
    const result = await pool.query(
      "UPDATE users SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id",
      [id]
    );
    return result.rows[0];
  }

  // Update last login timestamp
  static async updateLastLogin(id) {
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, login_attempts = 0 WHERE id = $1',
      [id]
    );
  }

  // Increment login attempts
  static async incrementLoginAttempts(username) {
    await pool.query(
      'UPDATE users SET login_attempts = login_attempts + 1 WHERE username = $1',
      [username]
    );
  }

  // Get count of active super_admins
  static async countActiveSuperAdmins() {
    const result = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'super_admin' AND status = 'active'"
    );
    return parseInt(result.rows[0].count);
  }

  // Find active users only (exclude deleted)
  static async findAllActive() {
    const result = await pool.query(
      "SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE status != 'deleted' ORDER BY created_at DESC"
    );
    return result.rows;
  }

  // Clear all sessions for a specific user
  static async clearUserSessions(userId) {
    // PostgreSQL-specific: connect-pg-simple stores sessions in 'session' table
    // Session data is in 'sess' JSONB column which contains user info
    const query = `
      DELETE FROM session
      WHERE sess::jsonb->'user'->>'id' = $1
    `;
    const result = await pool.query(query, [userId.toString()]);
    return result.rowCount;
  }
}

module.exports = User;
