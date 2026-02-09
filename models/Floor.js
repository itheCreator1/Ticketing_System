const pool = require('../config/database');

/**
 * Floor Model
 * Manages database operations for the floors table
 */
class Floor {
  /**
   * Find all active floors ordered by sort_order
   * @param {boolean} includeSystem - Include system floors (default: false)
   * @returns {Promise<Array>} Array of floor objects
   */
  static async findAll(includeSystem = false) {
    const query = includeSystem
      ? 'SELECT * FROM floors WHERE active = true ORDER BY sort_order, name'
      : 'SELECT * FROM floors WHERE active = true AND is_system = false ORDER BY sort_order, name';

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Find all floors including inactive (for admin management UI)
   * @returns {Promise<Array>} Array of all floors
   */
  static async findAllForAdmin() {
    const result = await pool.query(
      'SELECT * FROM floors ORDER BY is_system DESC, active DESC, sort_order, name'
    );
    return result.rows;
  }

  /**
   * Find floor by ID
   * @param {number} id - Floor ID
   * @returns {Promise<Object|undefined>} Floor object or undefined
   */
  static async findById(id) {
    const result = await pool.query('SELECT * FROM floors WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Find floor by name
   * @param {string} name - Floor name
   * @returns {Promise<Object|undefined>} Floor object or undefined
   */
  static async findByName(name) {
    const result = await pool.query('SELECT * FROM floors WHERE name = $1', [name]);
    return result.rows[0];
  }

  /**
   * Create a new floor
   * @param {Object} data - {name, sort_order}
   * @param {Object} client - Optional database client for transaction support
   * @returns {Promise<Object>} Created floor
   */
  static async create({ name, sort_order }, client = null) {
    const db = client || pool;
    const result = await db.query(
      `INSERT INTO floors (name, sort_order, is_system, active)
       VALUES ($1, $2, false, true)
       RETURNING *`,
      [name, sort_order || 0]
    );
    return result.rows[0];
  }

  /**
   * Update floor (only non-system floors)
   * @param {number} id - Floor ID
   * @param {Object} data - {name, sort_order, active}
   * @param {Object} client - Optional database client for transaction support
   * @returns {Promise<Object>} Updated floor
   */
  static async update(id, { name, sort_order, active }, client = null) {
    const db = client || pool;
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (sort_order !== undefined) {
      fields.push(`sort_order = $${paramCount}`);
      values.push(sort_order);
      paramCount++;
    }

    if (active !== undefined) {
      fields.push(`active = $${paramCount}`);
      values.push(active);
      paramCount++;
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(
      `UPDATE floors
       SET ${fields.join(', ')}
       WHERE id = $${paramCount} AND is_system = false
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Deactivate floor (soft delete, only non-system)
   * @param {number} id - Floor ID
   * @returns {Promise<Object>} Deactivated floor
   */
  static async deactivate(id) {
    const result = await pool.query(
      `UPDATE floors
       SET active = false, updated_at = NOW()
       WHERE id = $1 AND is_system = false
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Reactivate floor
   * @param {number} id - Floor ID
   * @returns {Promise<Object>} Reactivated floor
   */
  static async reactivate(id) {
    const result = await pool.query(
      `UPDATE floors
       SET active = true, updated_at = NOW()
       WHERE id = $1 AND is_system = false
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Count departments assigned to this floor
   * @param {string} name - Floor name
   * @returns {Promise<number>} Count of departments
   */
  static async countDepartments(name) {
    const result = await pool.query('SELECT COUNT(*) as count FROM departments WHERE floor = $1', [
      name,
    ]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Floor;
