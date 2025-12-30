const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class User {
  static async findById(id) {
    const startTime = Date.now();
    try {
      logger.debug('User.findById: Starting query', { userId: id });
      const result = await pool.query(
        'SELECT id, username, email, role, status, created_at FROM users WHERE id = $1',
        [id]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.findById: Slow query detected', { userId: id, duration });
      }

      logger.debug('User.findById: Query completed', { userId: id, found: !!result.rows[0], duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.findById: Database error', {
        userId: id,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async findByUsername(username) {
    const startTime = Date.now();
    try {
      logger.debug('User.findByUsername: Starting query', { username });
      const result = await pool.query(
        'SELECT id, username, email, role, status, login_attempts, created_at, updated_at FROM users WHERE username = $1',
        [username]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.findByUsername: Slow query detected', { username, duration });
      }

      logger.debug('User.findByUsername: Query completed', { username, found: !!result.rows[0], duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.findByUsername: Database error', {
        username,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // For authentication only - returns password_hash
  // This method should ONLY be used by authService for password verification
  static async findByUsernameWithPassword(username) {
    const startTime = Date.now();
    try {
      logger.debug('User.findByUsernameWithPassword: Starting query', { username });
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.findByUsernameWithPassword: Slow query detected', { username, duration });
      }

      logger.debug('User.findByUsernameWithPassword: Query completed', { username, found: !!result.rows[0], duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.findByUsernameWithPassword: Database error', {
        username,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async findByEmail(email) {
    const startTime = Date.now();
    try {
      logger.debug('User.findByEmail: Starting query', { email });
      const result = await pool.query(
        'SELECT id, username, email FROM users WHERE email = $1',
        [email]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.findByEmail: Slow query detected', { email, duration });
      }

      logger.debug('User.findByEmail: Query completed', { email, found: !!result.rows[0], duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.findByEmail: Database error', {
        email,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async create({ username, email, password, role = 'admin' }) {
    const startTime = Date.now();
    try {
      logger.debug('User.create: Starting user creation', { username, email, role });
      const password_hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
        [username, email, password_hash, role]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.create: Slow query detected', { username, email, role, duration });
      }

      logger.debug('User.create: User created successfully', { userId: result.rows[0].id, username, email, role, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.create: Database error', {
        username,
        email,
        role,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async findAll() {
    const startTime = Date.now();
    try {
      logger.debug('User.findAll: Starting query');
      const result = await pool.query(
        'SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC'
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.findAll: Slow query detected', { duration, rowCount: result.rows.length });
      }

      logger.debug('User.findAll: Query completed', { rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('User.findAll: Database error', {
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Update user fields (excluding password)
  static async update(id, { username, email, role, status }) {
    const startTime = Date.now();
    const fields = [];
    const values = [];
    let paramCount = 1;

    const updates = { username, email, role, status };
    const changedFields = Object.keys(updates).filter(key => updates[key] !== undefined);

    try {
      logger.debug('User.update: Starting user update', { userId: id, changedFields });

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
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.update: Slow query detected', { userId: id, duration, changedFields });
      }

      logger.debug('User.update: User updated successfully', { userId: id, changedFields, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.update: Database error', {
        userId: id,
        changedFields,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Update password (admin-initiated, no verification)
  static async updatePassword(id, newPassword) {
    const startTime = Date.now();
    try {
      logger.debug('User.updatePassword: Starting password update', { userId: id });
      const password_hash = await bcrypt.hash(newPassword, 10);
      const result = await pool.query(
        'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
        [password_hash, id]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.updatePassword: Slow query detected', { userId: id, duration });
      }

      logger.debug('User.updatePassword: Password updated successfully', { userId: id, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.updatePassword: Database error', {
        userId: id,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Soft delete user
  static async softDelete(id) {
    const startTime = Date.now();
    try {
      logger.debug('User.softDelete: Starting soft delete', { userId: id });
      const result = await pool.query(
        "UPDATE users SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id",
        [id]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.softDelete: Slow query detected', { userId: id, duration });
      }

      logger.debug('User.softDelete: User soft deleted successfully', { userId: id, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('User.softDelete: Database error', {
        userId: id,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Update last login timestamp
  static async updateLastLogin(id) {
    const startTime = Date.now();
    try {
      logger.debug('User.updateLastLogin: Updating last login', { userId: id });
      await pool.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, login_attempts = 0 WHERE id = $1',
        [id]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.updateLastLogin: Slow query detected', { userId: id, duration });
      }

      logger.debug('User.updateLastLogin: Last login updated successfully', { userId: id, duration });
    } catch (error) {
      logger.error('User.updateLastLogin: Database error', {
        userId: id,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Increment login attempts
  static async incrementLoginAttempts(username) {
    const startTime = Date.now();
    try {
      logger.debug('User.incrementLoginAttempts: Incrementing login attempts', { username });
      await pool.query(
        'UPDATE users SET login_attempts = login_attempts + 1 WHERE username = $1',
        [username]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.incrementLoginAttempts: Slow query detected', { username, duration });
      }

      logger.debug('User.incrementLoginAttempts: Login attempts incremented', { username, duration });
    } catch (error) {
      logger.error('User.incrementLoginAttempts: Database error', {
        username,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Get count of active super_admins
  static async countActiveSuperAdmins() {
    const startTime = Date.now();
    try {
      logger.debug('User.countActiveSuperAdmins: Starting count query');
      const result = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = 'super_admin' AND status = 'active'"
      );
      const duration = Date.now() - startTime;
      const count = parseInt(result.rows[0].count);

      if (duration > 500) {
        logger.warn('User.countActiveSuperAdmins: Slow query detected', { duration, count });
      }

      logger.debug('User.countActiveSuperAdmins: Query completed', { count, duration });
      return count;
    } catch (error) {
      logger.error('User.countActiveSuperAdmins: Database error', {
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Find active users only (exclude deleted)
  static async findAllActive() {
    const startTime = Date.now();
    try {
      logger.debug('User.findAllActive: Starting query');
      const result = await pool.query(
        "SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE status != 'deleted' ORDER BY created_at DESC"
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('User.findAllActive: Slow query detected', { duration, rowCount: result.rows.length });
      }

      logger.debug('User.findAllActive: Query completed', { rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('User.findAllActive: Database error', {
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Clear all sessions for a specific user
  static async clearUserSessions(userId) {
    const startTime = Date.now();
    try {
      logger.info('User.clearUserSessions: Clearing user sessions', { userId });
      // PostgreSQL-specific: connect-pg-simple stores sessions in 'session' table
      // Session data is in 'sess' JSONB column which contains user info
      const query = `
        DELETE FROM session
        WHERE sess::jsonb->'user'->>'id' = $1
      `;
      const result = await pool.query(query, [userId.toString()]);
      const duration = Date.now() - startTime;
      const sessionsCleared = result.rowCount;

      if (duration > 500) {
        logger.warn('User.clearUserSessions: Slow query detected', { userId, duration, sessionsCleared });
      }

      logger.info('User.clearUserSessions: Sessions cleared successfully', { userId, sessionsCleared, duration });
      return sessionsCleared;
    } catch (error) {
      logger.error('User.clearUserSessions: Database error', {
        userId,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }
}

module.exports = User;
