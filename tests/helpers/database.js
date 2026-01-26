/**
 * Database Test Helpers
 *
 * Provides utilities for managing test database state using transaction-based isolation.
 * Each test runs within a transaction that is rolled back after completion, ensuring
 * complete isolation and fast test execution.
 *
 * CRITICAL: Uses dedicated client from pool for transactions.
 * pool.query() auto-releases connections, breaking transaction isolation.
 * Must use client.query() to keep same connection for BEGIN/ROLLBACK.
 */

const pool = require('../../config/database');

// Store dedicated client for test transaction (per-test lifecycle)
let testClient = null;

/**
 * Begin a database transaction for test isolation
 * Call this in beforeEach() hooks
 * Also seeds required test departments to ensure FK constraints are satisfied
 *
 * IMPORTANT: Must acquire dedicated client from pool (not use pool.query directly)
 * to ensure BEGIN and ROLLBACK operate on same connection.
 */
async function setupTestDatabase() {
  // Acquire dedicated client from pool for this test's transaction
  testClient = await pool.connect();

  // Start transaction on dedicated client
  await testClient.query('BEGIN');

  // Seed required test departments for ticket creation tests
  // These departments match what createTicketData() factory uses
  const testDepartments = [
    { name: 'Emergency Department', description: 'Emergency and urgent care services', floor: 'Ground Floor' },
    { name: 'Cardiology', description: 'Cardiovascular and heart care services', floor: '2nd Floor' },
    { name: 'Radiology', description: 'Medical imaging and diagnostic radiology', floor: '3rd Floor' },
    { name: 'Pharmacy', description: 'Pharmaceutical services and medication management', floor: '1st Floor' },
    { name: 'Laboratory', description: 'Clinical laboratory and pathology services', floor: 'Ground Floor' },
    { name: 'IT Support', description: 'IT Support Services', floor: 'Ground Floor' },
    { name: 'Finance', description: 'Finance Department', floor: 'Ground Floor' },
    { name: 'Facilities', description: 'Facilities Management', floor: '1st Floor' },
    { name: 'Internal', description: 'Internal admin-only department', floor: 'Ground Floor', is_system: true }
  ];

  for (const dept of testDepartments) {
    await testClient.query(
      `INSERT INTO departments (name, description, floor, is_system, active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (name) DO NOTHING`,
      [dept.name, dept.description, dept.floor, dept.is_system || false]
    );
  }
}

/**
 * Rollback the current transaction to clean up test data
 * Call this in afterEach() hooks
 *
 * CRITICAL: Must use same client that was used for BEGIN.
 * Also must release client back to pool to prevent connection leaks.
 */
async function teardownTestDatabase() {
  if (testClient) {
    try {
      // Rollback transaction on dedicated client
      await testClient.query('ROLLBACK');
    } finally {
      // Always release client back to pool, even if ROLLBACK fails
      testClient.release();
      testClient = null;
    }
  }
}

/**
 * Delete all rows from a specific table
 * Use this when you need explicit cleanup (not common with transaction rollback)
 * @param {string} tableName - Name of the table to clean
 */
async function cleanTable(tableName) {
  await pool.query(`DELETE FROM ${tableName}`);
}

/**
 * Delete all rows from all tables in the correct order to respect FK constraints
 * Order: audit_logs, comments, tickets, session, users
 */
async function cleanAllTables() {
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM comments');
  await pool.query('DELETE FROM tickets');
  await pool.query('DELETE FROM session');
  await pool.query('DELETE FROM users');
}

/**
 * Get the current test client for use in test code
 * MUST only be called within a test (after setupTestDatabase)
 * @returns {object} The pg client connection for this test's transaction
 * @throws {Error} If called outside a test transaction
 */
function getTestClient() {
  if (!testClient) {
    throw new Error(
      'getTestClient() called outside test transaction. ' +
      'Did you forget to call setupTestDatabase() in beforeEach()? ' +
      'All database operations in tests must use getTestClient() to maintain transaction isolation.'
    );
  }
  return testClient;
}

/**
 * Reset auto-increment sequences for all tables
 * Useful when you need predictable IDs in tests
 */
async function resetSequences() {
  await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE tickets_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE comments_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1');
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  getTestClient,
  cleanTable,
  cleanAllTables,
  resetSequences
};
