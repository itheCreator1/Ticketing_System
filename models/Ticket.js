const pool = require('../config/database');
const logger = require('../utils/logger');
const { sanitizeSearchInput } = require('../utils/sanitizeSearch');

class Ticket {
  static async create(
    {
      title,
      description,
      reporter_name,
      reporter_department,
      reporter_phone,
      reporter_id,
      priority = 'unset',
      status = 'open',
      is_admin_created = false,
    },
    client = null
  ) {
    const db = client || pool;
    const startTime = Date.now();
    try {
      logger.info('Ticket.create: Creating new ticket', {
        reporterDepartment: reporter_department,
        reporterId: reporter_id,
        priority,
        status,
        isAdminCreated: is_admin_created,
        titleLength: title?.length,
      });
      const result = await db.query(
        `INSERT INTO tickets (title, description, reporter_name, reporter_department, reporter_phone, reporter_id, priority, status, is_admin_created)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          title,
          description,
          reporter_name || null,
          reporter_department,
          reporter_phone,
          reporter_id || null,
          priority,
          status,
          is_admin_created,
        ]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.create: Slow query detected', {
          reporterDepartment: reporter_department,
          reporterId: reporter_id,
          priority,
          status,
          duration,
        });
      }

      logger.info('Ticket.create: Ticket created successfully', {
        ticketId: result.rows[0].id,
        reporterDepartment: reporter_department,
        reporterId: reporter_id,
        priority,
        status,
        duration,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Ticket.create: Database error', {
        reporterDepartment: reporter_department,
        reporterId: reporter_id,
        priority,
        status,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findById(id) {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.findById: Starting query', { ticketId: id });
      const result = await pool.query(
        `SELECT t.*, u.username as assigned_to_username, d.floor as department_floor
         FROM tickets t
         LEFT JOIN users u ON t.assigned_to = u.id
         LEFT JOIN departments d ON t.reporter_department = d.name
         WHERE t.id = $1`,
        [id]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findById: Slow query detected', { ticketId: id, duration });
      }

      logger.debug('Ticket.findById: Query completed', {
        ticketId: id,
        found: !!result.rows[0],
        duration,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Ticket.findById: Database error', {
        ticketId: id,
        error: error.message,
        stack: error.stack,
        code: error.code,
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
        const sanitizedSearch = sanitizeSearchInput(filters.search);
        params.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findAll: Slow query detected', {
          filters,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('Ticket.findAll: Query completed', {
        filters,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.findAll: Database error', {
        filters,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findByDepartment(department, filters = {}) {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.findByDepartment: Starting query', { department, filters });
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
        WHERE t.reporter_department = $1
          AND t.is_admin_created = false
      `;
      const params = [department];
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
        const sanitizedSearch = sanitizeSearchInput(filters.search);
        params.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findByDepartment: Slow query detected', {
          department,
          filters,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('Ticket.findByDepartment: Query completed', {
        department,
        filters,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.findByDepartment: Database error', {
        department,
        filters,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async update(id, { status, priority, assigned_to }, client = null) {
    const db = client || pool;
    const startTime = Date.now();
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const changes = { status, priority, assigned_to };
    const changedFields = Object.keys(changes).filter((key) => changes[key] !== undefined);

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

      updates.push('updated_at = CURRENT_TIMESTAMP');

      params.push(id);
      const query = `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await db.query(query, params);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.update: Slow query detected', {
          ticketId: id,
          changedFields,
          duration,
        });
      }

      logger.info('Ticket.update: Ticket updated successfully', {
        ticketId: id,
        changedFields,
        duration,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Ticket.update: Database error', {
        ticketId: id,
        changedFields,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async getCountsByStatus() {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.getCountsByStatus: Starting count query');
      const result = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM tickets
        GROUP BY status
      `);
      const duration = Date.now() - startTime;

      logger.debug('Ticket.getCountsByStatus: Query completed', {
        duration,
        groups: result.rows.length,
      });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.getCountsByStatus: Database error', {
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async getCountsByPriority() {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.getCountsByPriority: Starting count query');
      const result = await pool.query(`
        SELECT priority, COUNT(*) as count
        FROM tickets
        GROUP BY priority
      `);
      const duration = Date.now() - startTime;

      logger.debug('Ticket.getCountsByPriority: Query completed', {
        duration,
        groups: result.rows.length,
      });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.getCountsByPriority: Database error', {
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async bulkUpdate(ticketIds, updates) {
    const startTime = Date.now();
    try {
      logger.info('Ticket.bulkUpdate: Starting bulk update', {
        ticketCount: ticketIds.length,
        updates,
      });

      // Build dynamic UPDATE query
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex}`);
        values.push(updates.status);
        paramIndex++;
      }

      if (updates.priority !== undefined) {
        fields.push(`priority = $${paramIndex}`);
        values.push(updates.priority);
        paramIndex++;
      }

      if (updates.assigned_to !== undefined) {
        fields.push(`assigned_to = $${paramIndex}`);
        values.push(updates.assigned_to);
        paramIndex++;
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(ticketIds);

      const result = await pool.query(
        `
        UPDATE tickets
        SET ${fields.join(', ')}
        WHERE id = ANY($${paramIndex}::int[])
        RETURNING *
      `,
        values
      );

      const duration = Date.now() - startTime;

      if (duration > 1000) {
        logger.warn('Ticket.bulkUpdate: Slow query detected', {
          ticketCount: ticketIds.length,
          duration,
        });
      }

      logger.info('Ticket.bulkUpdate: Bulk update completed', {
        ticketCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('Ticket.bulkUpdate: Database error', {
        ticketCount: ticketIds.length,
        updates,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findAllPaginated(filters = {}, page = 1, limit = 50) {
    const startTime = Date.now();
    try {
      logger.debug('Ticket.findAllPaginated: Starting query', { filters, page, limit });

      const offset = (page - 1) * limit;
      const params = [];
      const conditions = [];
      let paramIndex = 1;

      // Build WHERE clause
      if (filters.status) {
        conditions.push(`t.status = $${paramIndex}`);
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.priority) {
        conditions.push(`t.priority = $${paramIndex}`);
        params.push(filters.priority);
        paramIndex++;
      }

      if (filters.search) {
        conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count for pagination
      const countResult = await pool.query(
        `
        SELECT COUNT(*) as total
        FROM tickets t
        ${whereClause}
      `,
        params
      );

      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / limit);

      // Get paginated results
      params.push(limit);
      params.push(offset);

      const result = await pool.query(
        `
        SELECT t.*, u.username as assigned_to_username
        FROM tickets t
        LEFT JOIN users u ON t.assigned_to = u.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
        params
      );

      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Ticket.findAllPaginated: Slow query detected', { filters, page, duration });
      }

      logger.debug('Ticket.findAllPaginated: Query completed', {
        filters,
        page,
        rowCount: result.rows.length,
        totalCount,
        duration,
      });

      return {
        tickets: result.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Ticket.findAllPaginated: Database error', {
        filters,
        page,
        limit,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }
}

module.exports = Ticket;
