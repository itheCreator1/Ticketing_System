/**
 * Global Test Setup
 *
 * This file runs before all tests to configure the testing environment.
 * It loads test environment variables, suppresses logging, and registers
 * custom Jest matchers.
 */

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Suppress logging during tests to keep output clean
process.env.LOG_LEVEL = 'error';

// Load custom Jest matchers
require('./helpers/assertions');

// Configure global test timeout (10 seconds)
jest.setTimeout(10000);

// Suppress console.warn and console.error during tests to reduce noise
// Uncomment these lines if you want completely silent tests
// global.console = {
//   ...console,
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global teardown - close database pool after all tests
afterAll(async () => {
  const pool = require('../config/database');
  await pool.end();
});
