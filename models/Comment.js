const pool = require('../config/database');
const logger = require('../utils/logger');

class Comment {
  static async create({ ticket_id, user_id, content, is_internal = false }) {
    const startTime = Date.now();
    try {
      logger.info('Comment.create: Creating new comment', { ticketId: ticket_id, userId: user_id, isInternal: is_internal, contentLength: content?.length });
      const result = await pool.query(
        `INSERT INTO comments (ticket_id, user_id, content, is_internal)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ticket_id, user_id, content, is_internal]
      );
      const duration = Date.now() - startTime;

      if (duration > 500) {
        logger.warn('Comment.create: Slow query detected', { ticketId: ticket_id, userId: user_id, duration });
      }

      logger.info('Comment.create: Comment created successfully', { commentId: result.rows[0].id, ticketId: ticket_id, userId: user_id, duration });
      return result.rows[0];
    } catch (error) {
      logger.error('Comment.create: Database error', {
        ticketId: ticket_id,
        userId: user_id,
        error: error.message,
        stack: error.stack,
        code: error.code
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
        logger.warn('Comment.findByTicketId: Slow query detected', { ticketId, duration, rowCount: result.rows.length });
      }

      logger.debug('Comment.findByTicketId: Query completed', { ticketId, rowCount: result.rows.length, duration });
      return result.rows;
    } catch (error) {
      logger.error('Comment.findByTicketId: Database error', {
        ticketId,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }
}

module.exports = Comment;
