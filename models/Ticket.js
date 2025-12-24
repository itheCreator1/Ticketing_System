const pool = require('../config/database');

class Ticket {
  static async create({ title, description, reporter_name, reporter_email, reporter_phone, priority = 'medium' }) {
    const result = await pool.query(
      `INSERT INTO tickets (title, description, reporter_name, reporter_email, reporter_phone, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *`,
      [title, description, reporter_name, reporter_email, reporter_phone, priority]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT t.*, u.username as assigned_to_username
       FROM tickets t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT t.*, u.username as assigned_to_username
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
    return result.rows;
  }

  static async update(id, { status, priority, assigned_to }) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

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
    return result.rows[0];
  }
}

module.exports = Ticket;
