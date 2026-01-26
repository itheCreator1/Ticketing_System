/**
 * Performance Benchmark Runner Utilities
 *
 * Provides helpers for running autocannon benchmarks and reporting results
 */

const autocannon = require('autocannon');
const pool = require('../../../config/database');
const { createUserData } = require('../../helpers/factories');

/**
 * Print formatted benchmark results
 * @param {Object} result - Autocannon result object
 * @param {string} name - Benchmark name
 */
function printResults(result, name = 'Benchmark') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${name} Results`);
  console.log('='.repeat(60));

  if (result.errors && result.errors > 0) {
    console.log(`⚠️  Errors: ${result.errors}`);
  }

  if (result.requests) {
    console.log(`\n📈 Throughput:`);
    console.log(`  Total Requests: ${result.requests.total}`);
    console.log(`  Average: ${result.requests.average.toFixed(2)} req/sec`);
    console.log(`  Per Second: ${result.requests.p99} req/sec (p99)`);
  }

  if (result.latency) {
    console.log(`\n⏱️  Latency (ms):`);
    console.log(`  P50: ${result.latency.p50.toFixed(2)}ms`);
    console.log(`  P95: ${result.latency.p95.toFixed(2)}ms`);
    console.log(`  P99: ${result.latency.p99.toFixed(2)}ms`);
    console.log(`  Mean: ${result.latency.mean.toFixed(2)}ms`);
  }

  if (result.throughput) {
    console.log(`\n💾 Throughput:`);
    console.log(`  P50: ${(result.throughput.p50 / 1024).toFixed(2)} KB/sec`);
    console.log(`  P95: ${(result.throughput.p95 / 1024).toFixed(2)} KB/sec`);
    console.log(`  Mean: ${(result.throughput.mean / 1024).toFixed(2)} KB/sec`);
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Run a single autocannon benchmark
 * @param {Object} options - Autocannon options
 * @returns {Promise<Object>} Benchmark result
 */
async function runBenchmark(options) {
  try {
    const result = await autocannon({
      ...options,
      setupClient: (client) => {
        client.on('response', () => {});
      }
    });
    return result;
  } catch (error) {
    console.error(`Error running benchmark: ${error.message}`);
    throw error;
  }
}

/**
 * Create test user for authentication benchmarks
 * @returns {Promise<Object>} User object with id and credentials
 */
async function createTestUser(overrides = {}) {
  try {
    const userData = createUserData({ role: 'admin', ...overrides });
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, username',
      [userData.username, userData.email, userData.password_hash, userData.role, userData.status]
    );
    return {
      id: result.rows[0].id,
      username: userData.username,
      password: userData.password || 'ValidPass123!'
    };
  } catch (error) {
    console.error(`Error creating test user: ${error.message}`);
    throw error;
  }
}

/**
 * Create test department
 * @returns {Promise<string>} Department name
 */
async function createTestDepartment(name = 'BenchmarkDept') {
  try {
    const result = await pool.query(
      'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING name',
      [name, 'Benchmark Department', 'Ground Floor', false, true]
    );
    return result.rows[0].name;
  } catch (error) {
    console.error(`Error creating test department: ${error.message}`);
    throw error;
  }
}

/**
 * Create test ticket
 * @returns {Promise<number>} Ticket ID
 */
async function createTestTicket(overrides = {}) {
  try {
    const result = await pool.query(
      'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [
        overrides.title || 'Benchmark Ticket',
        overrides.description || 'Test ticket for benchmarking',
        overrides.status || 'open',
        overrides.priority || 'unset',
        overrides.reporter_name || 'BenchmarkUser',
        overrides.reporter_department || 'Internal'
      ]
    );
    return result.rows[0].id;
  } catch (error) {
    console.error(`Error creating test ticket: ${error.message}`);
    throw error;
  }
}

/**
 * Seed minimal benchmark data
 * @returns {Promise<Object>} Objects containing benchmark data references
 */
async function seedBenchmarkData() {
  try {
    const user = await createTestUser();
    const department = await createTestDepartment();
    const ticket = await createTestTicket();

    return { user, department, ticket };
  } catch (error) {
    console.error(`Error seeding benchmark data: ${error.message}`);
    throw error;
  }
}

/**
 * Clean up benchmark data
 */
async function cleanupBenchmarkData() {
  try {
    await pool.query('TRUNCATE users CASCADE');
    await pool.query('TRUNCATE tickets CASCADE');
    await pool.query('TRUNCATE departments CASCADE');
    await pool.query('TRUNCATE comments CASCADE');
  } catch (error) {
    console.error(`Error cleaning up benchmark data: ${error.message}`);
  }
}

/**
 * Format latency value with color coding
 * @param {number} value - Latency in ms
 * @param {number} threshold - SLA threshold in ms
 * @returns {string} Formatted value with color indicator
 */
function formatLatency(value, threshold = 500) {
  const ms = value.toFixed(2);
  if (value <= threshold * 0.5) {
    return `✅ ${ms}ms`;
  } else if (value <= threshold) {
    return `⚠️  ${ms}ms`;
  } else {
    return `❌ ${ms}ms`;
  }
}

/**
 * Check if benchmark meets SLA
 * @param {Object} result - Autocannon result
 * @param {number} p95Threshold - P95 SLA threshold in ms
 * @returns {boolean} True if SLA is met
 */
function meetsLodgingSLA(result, p95Threshold = 500) {
  return result.latency && result.latency.p95 <= p95Threshold && result.errors === 0;
}

module.exports = {
  runBenchmark,
  printResults,
  createTestUser,
  createTestDepartment,
  createTestTicket,
  seedBenchmarkData,
  cleanupBenchmarkData,
  formatLatency,
  meetsLodgingSLA
};
