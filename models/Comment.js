const pool = require('../config/database');

class Comment {
  static async create({ ticket_id, user_id, content, is_internal = false }) {
    const result = await pool.query(
      `INSERT INTO comments (ticket_id, user_id, content, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticket_id, user_id, content, is_internal]
    );
    return result.rows[0];
  }

  static async findByTicketId(ticketId) {
    const result = await pool.query(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.ticket_id = $1
       ORDER BY c.created_at ASC`,
      [ticketId]
    );
    return result.rows;
  }
}

module.exports = Comment;
