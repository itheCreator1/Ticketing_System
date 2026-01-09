const pool = require('../config/database');
const logger = require('../utils/logger');

class Ticket {
  static async create({ title, description, reporter_name, reporter_department, reporter_phone, reporter_id, priority = 'unset', status = 'open', is_admin_created = false }) {
    const startTime = Date.now();
    try {
      logger.info('Ticket.create: Creating new ticket', { reporterDepartment: reporter_department, reporterId: reporter_id, priority, status, isAdminCreated: is_admin_created, titleLength: title?.length });
      const result = await pool.query(
        `INSERT INTO tickets (title, description, reporter_name, reporter_department, reporter_phone, reporter_id, priority, status, is_admin_created)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [title, description, reporter_name || null, reporter_department, reporter_phone, reporter_id || null, priority, status, is_admin_created]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.create: Slow query detected', { reporterDepartment: reporter_department, reporterId: reporter_id, priority, status, duration });
      }

      logger.info('Ticket.create: Ticket created successfully', { ticketId: result.rows[0].id, reporterDepartment: reporter_department, reporterId: reporter_id, priority, status, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('Ticket.create: Database error', {
        reporterDepartment: reporter_department,
        reporterId: reporter_id,
        priority,
        status,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async findById(id) {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.findById: Starting query', { ticketId: id });
      const result = await pool.query(
        `SELECT t.*, u.username as assigned_to_username
         FROM tickets t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.id = $1`,
        [id]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findById: Slow query detected', { ticketId: id, duration });
      }

      logger.debug('Ticket.findById: Query completed', { ticketId: id, found: !!result.rows[0], duration });
      return result.rows[0];
    } catch (error) {
      logger.error('Ticket.findById: Database error', {
        ticketId: id,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async findAll(filters = {}) {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.findAll: Starting query', { filters });
      let query = `
        SELECT
          t.*,
          u.username as assigned_to_username,
          (
            SELECT content
            FROM comments
            WHERE ticket_id = t.id AND visibility_type = 'public'
            ORDER BY created_at DESC
            LIMIT 1
          ) as last_comment
        FROM tickets t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (filters.status) {
        query += ` AND t.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.priority) {
        query += ` AND t.priority = $${paramIndex}`;
        params.push(filters.priority);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findAll: Slow query detected', { filters, duration, rowCount: result.rows.length });
      }

      logger.debug('Ticket.findAll: Query completed', { filters, rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.findAll: Database error', {
        filters,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async findByDepartment(userId, filters = {}) {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.findByDepartment: Starting query', { userId, filters });
      let query = `
        SELECT
          t.*,
          u.username as assigned_to_username,
          (
            SELECT content
            FROM comments
            WHERE ticket_id = t.id AND visibility_type = 'public'
            ORDER BY created_at DESC
            LIMIT 1
          ) as last_comment
        FROM tickets t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.reporter_id = $1
          AND t.is_admin_created = false
      `;
      const params = [userId];
      let paramIndex = 2;

      if (filters.status) {
        query += ` AND t.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.priority) {
        query += ` AND t.priority = $${paramIndex}`;
        params.push(filters.priority);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findByDepartment: Slow query detected', { userId, filters, duration, rowCount: result.rows.length });
      }

      logger.debug('Ticket.findByDepartment: Query completed', { userId, filters, rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.findByDepartment: Database error', {
        userId,
        filters,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  static async update(id, { status, priority, assigned_to }) {
    const startTime = Date.now();
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const changes = { status, priority, assigned_to };
    const changedFields = Object.keys(changes).filter(key => changes[key] !== undefined);

    try {
      logger.info('Ticket.update: Starting ticket update', { ticketId: id, changedFields });

      if (status) {
        updates.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        updates.push(`priority = $${paramIndex}`);
        params.push(priority);
        paramIndex++;
      }

      if (assigned_to !== undefined) {
        updates.push(`assigned_to = $${paramIndex}`);
        params.push(assigned_to);
        paramIndex++;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      params.push(id);
      const query = `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.update: Slow query detected', { ticketId: id, changedFields, duration });
      }

      logger.info('Ticket.update: Ticket updated successfully', { ticketId: id, changedFields, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('Ticket.update: Database error', {
        ticketId: id,
        changedFields,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }
}

module.exports = Ticket;
