const pool = require('../config/database');

/**
 * Department Model
 * Manages database operations for the departments table
 */
class Department {
  /**
   * Find all active departments (non-system for user selection)
   * @param {boolean} includeSystem - Include system departments (default: false)
   * @returns {Promise<Array>} Array of department objects
   */
  static async findAll(includeSystem = false) {
    const query = includeSystem
      ? 'SELECT * FROM departments WHERE active = true ORDER BY name'
      : 'SELECT * FROM departments WHERE active = true AND is_system = false ORDER BY name';

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Find all departments including inactive (for admin management UI)
   * @returns {Promise<Array>} Array of all departments
   */
  static async findAllForAdmin() {
    const result = await pool.query(
      'SELECT * FROM departments ORDER BY is_system DESC, active DESC, name'
    );
    return result.rows;
  }

  /**
   * Find department by ID
   * @param {number} id - Department ID
   * @returns {Promise<Object|undefined>} Department object or undefined
   */
  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM departments WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  /**
   * Find department by name
   * @param {string} name - Department name
   * @returns {Promise<Object|undefined>} Department object or undefined
   */
  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM departments WHERE name = $1',
      [name]
    );
    return result.rows[0];
  }

  /**
   * Create a new department
   * @param {Object} data - {name, description}
   * @returns {Promise<Object>} Created department
   */
  static async create({ name, description }) {
    const result = await pool.query(
      `INSERT INTO departments (name, description, is_system, active)
       VALUES ($1, $2, false, true)
       RETURNING *`,
      [name, description || null]
    );
    return result.rows[0];
  }

  /**
   * Update department (only non-system departments)
   * @param {number} id - Department ID
   * @param {Object} data - {name, description, active}
   * @returns {Promise<Object>} Updated department
   */
  static async update(id, { name, description, active }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (active !== undefined) {
      fields.push(`active = $${paramCount}`);
      values.push(active);
      paramCount++;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE departments
       SET ${fields.join(', ')}
       WHERE id = $${paramCount} AND is_system = false
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Deactivate department (soft delete, only non-system)
   * @param {number} id - Department ID
   * @returns {Promise<Object>} Deactivated department
   */
  static async deactivate(id) {
    const result = await pool.query(
      `UPDATE departments
       SET active = false, updated_at = NOW()
       WHERE id = $1 AND is_system = false
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Check if department has users assigned
   * @param {string} name - Department name
   * @returns {Promise<number>} Count of users
   */
  static async countUsers(name) {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE department = $1',
      [name]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if department has tickets
   * @param {string} name - Department name
   * @returns {Promise<number>} Count of tickets
   */
  static async countTickets(name) {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM tickets WHERE reporter_department = $1',
      [name]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = Department;
