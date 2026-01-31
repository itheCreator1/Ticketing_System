/**
 * Database schema introspection utilities for migration testing
 * Provides helpers to verify schema structure, constraints, and integrity
 */

const pool = require('../../config/database');

/**
 * Get all tables in the public schema
 * @returns {Promise<string[]>} Array of table names
 */
async function getTableNames() {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  return result.rows.map(r => r.table_name);
}

/**
 * Get all columns for a table with their properties
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of column objects with: column_name, data_type, character_maximum_length, is_nullable, column_default
 */
async function getTableColumns(tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, character_maximum_length,
           is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

/**
 * Check if a specific column exists in a table
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<boolean>} True if column exists
 */
async function columnExists(tableName, columnName) {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
  `, [tableName, columnName]);
  return result.rows.length > 0;
}

/**
 * Get all indexes for a table
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of index objects with: indexname, indexdef
 */
async function getTableIndexes(tableName) {
  const result = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = $1 AND schemaname = 'public'
    ORDER BY indexname
  `, [tableName]);
  return result.rows;
}

/**
 * Get all unique constraints for a table
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of constraint names
 */
async function getUniqueConstraints(tableName) {
  const result = await pool.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = $1 AND constraint_type = 'UNIQUE' AND table_schema = 'public'
  `, [tableName]);
  return result.rows.map(r => r.constraint_name);
}

/**
 * Get all primary key constraints
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of column names in primary key
 */
async function getPrimaryKeyColumns(tableName) {
  const result = await pool.query(`
    SELECT a.attname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = $1 AND c.contype = 'p'
    ORDER BY a.attnum
  `, [tableName]);
  return result.rows.map(r => r.attname);
}

/**
 * Get all foreign key constraints for a table
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of FK constraint objects
 */
async function getForeignKeys(tableName) {
  const result = await pool.query(`
    SELECT
      rc.constraint_name,
      kcu.column_name,
      kcu2.table_name as foreign_table_name,
      kcu2.column_name as foreign_column_name,
      CASE
        WHEN rc.update_rule = 'CASCADE' THEN 'CASCADE'
        WHEN rc.update_rule = 'SET NULL' THEN 'SET NULL'
        WHEN rc.update_rule = 'RESTRICT' THEN 'RESTRICT'
        ELSE rc.update_rule
      END as on_update,
      CASE
        WHEN rc.delete_rule = 'CASCADE' THEN 'CASCADE'
        WHEN rc.delete_rule = 'SET NULL' THEN 'SET NULL'
        WHEN rc.delete_rule = 'RESTRICT' THEN 'RESTRICT'
        ELSE rc.delete_rule
      END as on_delete
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND rc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.key_column_usage kcu2
      ON rc.unique_constraint_name = kcu2.constraint_name
      AND rc.constraint_schema = kcu2.table_schema
    WHERE kcu.table_name = $1 AND kcu.table_schema = 'public'
  `, [tableName]);
  return result.rows;
}

/**
 * Get all CHECK constraints for a table
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of check constraints with: constraint_name, check_clause
 */
async function getCheckConstraints(tableName) {
  const result = await pool.query(`
    SELECT cc.constraint_name, cc.check_clause
    FROM information_schema.check_constraints cc
    JOIN information_schema.table_constraints tc
      ON cc.constraint_name = tc.constraint_name
    WHERE tc.table_name = $1 AND tc.table_schema = 'public'
  `, [tableName]);
  return result.rows;
}

/**
 * Verify a CHECK constraint exists and get its definition
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @param {Array<string>} allowedValues - Allowed values for enum-like checks
 * @returns {Promise<boolean>} True if constraint exists and includes all allowed values
 */
async function verifyCheckConstraint(tableName, columnName, allowedValues) {
  const constraints = await getCheckConstraints(tableName);
  const checkConstraint = constraints.find(c =>
    c.check_clause && c.check_clause.includes(columnName)
  );

  if (!checkConstraint) {
    return false;
  }

  // Verify all allowed values are in the constraint
  return allowedValues.every(val =>
    checkConstraint.check_clause.includes(`'${val}'`)
  );
}

/**
 * Get all tables with their row counts
 * @returns {Promise<Array>} Array of objects with: table_name, row_count
 */
async function getTableRowCounts() {
  const result = await pool.query(`
    SELECT schemaname, tablename,
           (xpath('/row[1]/count/text()', query_to_xml('SELECT count(*) FROM ' || schemaname||'.'||tablename, false, true, '')))[1]::text::int as row_count
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return result.rows;
}

/**
 * Get data type of a column
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<string>} Data type (e.g., 'integer', 'character varying')
 */
async function getColumnDataType(tableName, columnName) {
  const result = await pool.query(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
  `, [tableName, columnName]);

  if (result.rows.length === 0) {
    throw new Error(`Column ${columnName} not found in table ${tableName}`);
  }

  return result.rows[0].data_type;
}

/**
 * Check if a column is nullable
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<boolean>} True if column is nullable
 */
async function isColumnNullable(tableName, columnName) {
  const result = await pool.query(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
  `, [tableName, columnName]);

  if (result.rows.length === 0) {
    throw new Error(`Column ${columnName} not found in table ${tableName}`);
  }

  return result.rows[0].is_nullable === 'YES';
}

/**
 * Get character maximum length of a column
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<number|null>} Maximum length or null if not applicable
 */
async function getColumnMaxLength(tableName, columnName) {
  const result = await pool.query(`
    SELECT character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
  `, [tableName, columnName]);

  if (result.rows.length === 0) {
    throw new Error(`Column ${columnName} not found in table ${tableName}`);
  }

  return result.rows[0].character_maximum_length;
}

/**
 * Get default value of a column
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<string|null>} Default value or null
 */
async function getColumnDefault(tableName, columnName) {
  const result = await pool.query(`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
  `, [tableName, columnName]);

  if (result.rows.length === 0) {
    throw new Error(`Column ${columnName} not found in table ${tableName}`);
  }

  return result.rows[0].column_default;
}

/**
 * Verify that a table has all expected columns
 * @param {string} tableName - Table name
 * @param {Array<string>} expectedColumns - Expected column names
 * @returns {Promise<{missing: Array, extra: Array}>} Missing and extra columns
 */
async function verifyTableColumns(tableName, expectedColumns) {
  const actualColumns = await getTableColumns(tableName);
  const actualNames = actualColumns.map(c => c.column_name);

  return {
    missing: expectedColumns.filter(col => !actualNames.includes(col)),
    extra: actualNames.filter(col => !expectedColumns.includes(col))
  };
}

module.exports = {
  getTableNames,
  getTableColumns,
  columnExists,
  getTableIndexes,
  getUniqueConstraints,
  getPrimaryKeyColumns,
  getForeignKeys,
  getCheckConstraints,
  verifyCheckConstraint,
  getTableRowCounts,
  getColumnDataType,
  isColumnNullable,
  getColumnMaxLength,
  getColumnDefault,
  verifyTableColumns
};
