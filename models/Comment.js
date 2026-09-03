const pool = require('../config/database');
const logger = require('../utils/logger');

class Comment {
  static async create({ ticket_id, user_id, content, visibility_type = 'public' }, client = null) {
    const db = client || pool;
    const startTime = Date.now();
    try {
      logger.info('Comment.create: Creating new comment', {
        ticketId: ticket_id,
        userId: user_id,
        visibilityType: visibility_type,
        contentLength: content?.length,
      });
      const result = await db.query(
        `INSERT INTO comments (ticket_id, user_id, content, visibility_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ticket_id, user_id, content, visibility_type]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Comment.create: Slow query detected', {
          ticketId: ticket_id,
          userId: user_id,
          visibilityType: visibility_type,
          duration,
        });
      }

      logger.info('Comment.create: Comment created successfully', {
        commentId: result.rows[0].id,
        ticketId: ticket_id,
        userId: user_id,
        visibilityType: visibility_type,
        duration,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Comment.create: Database error', {
        ticketId: ticket_id,
        userId: user_id,
        visibilityType: visibility_type,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findByTicketId(ticketId) {
    const startTime = Date.now();
    try {
      logger.debug('Comment.findByTicketId: Starting query', { ticketId });
      const result = await pool.query(
        `SELECT c.*, u.username
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.ticket_id = $1
         ORDER BY c.created_at ASC`,
        [ticketId]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Comment.findByTicketId: Slow query detected', {
          ticketId,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('Comment.findByTicketId: Query completed', {
        ticketId,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('Comment.findByTicketId: Database error', {
        ticketId,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async findVisibleByTicketId(ticketId, userRole) {
    const startTime = Date.now();

    // Security validation: whitelist valid roles
    const validRoles = ['admin', 'super_admin', 'department'];
    if (!validRoles.includes(userRole)) {
      const error = new Error(`Invalid user role: ${userRole}`);
      logger.error('Comment.findVisibleByTicketId: Invalid role', { ticketId, userRole });
      throw error;
    }

    try {
      logger.debug('Comment.findVisibleByTicketId: Starting query', { ticketId, userRole });

      let query = `
        SELECT c.*, u.username
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = $1
      `;

      // Department users only see public comments (security filter at SQL level)
      if (userRole === 'department') {
        query += " AND c.visibility_type = 'public'";
      }
      // Admin and super_admin see all comments (no additional filter)

      query += ' ORDER BY c.created_at ASC';

      const result = await pool.query(query, [ticketId]);
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Comment.findVisibleByTicketId: Slow query detected', {
          ticketId,
          userRole,
          duration,
          rowCount: result.rows.length,
        });
      }

      logger.debug('Comment.findVisibleByTicketId: Query completed', {
        ticketId,
        userRole,
        rowCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('Comment.findVisibleByTicketId: Database error', {
        ticketId,
        userRole,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }

  static async getLastCommentsByTicketIds(ticketIds) {
    const startTime = Date.now();
    try {
      if (!ticketIds || ticketIds.length === 0) {
        logger.debug('Comment.getLastCommentsByTicketIds: Empty ticket IDs array');
        return [];
      }

      logger.debug('Comment.getLastCommentsByTicketIds: Starting query', {
        ticketCount: ticketIds.length,
      });
      const result = await pool.query(
        `
        SELECT DISTINCT ON (c.ticket_id)
          c.ticket_id,
          c.content,
          u.username,
          c.created_at
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = ANY($1::int[])
        ORDER BY c.ticket_id, c.created_at DESC
      `,
        [ticketIds]
      );

      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Comment.getLastCommentsByTicketIds: Slow query detected', {
          ticketCount: ticketIds.length,
          duration,
        });
      }

      logger.debug('Comment.getLastCommentsByTicketIds: Query completed', {
        ticketCount: ticketIds.length,
        resultCount: result.rows.length,
        duration,
      });
      return result.rows;
    } catch (error) {
      logger.error('Comment.getLastCommentsByTicketIds: Database error', {
        ticketCount: ticketIds?.length,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    }
  }
}

module.exports = Comment;
