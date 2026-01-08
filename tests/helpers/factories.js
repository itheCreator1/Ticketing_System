/**
 * Test Data Factories
 *
 * Provides functions to generate dynamic test data with unique values.
 * Use factories instead of hardcoded test data to avoid conflicts between tests.
 */

/**
 * Generate a unique email address
 * @returns {string} Unique email
 */
function generateUniqueEmail() {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;
}

/**
 * Generate a unique username
 * @returns {string} Unique username
 */
function generateUniqueUsername() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create user test data with sensible defaults
 * @param {Object} overrides - Override default values
 * @returns {Object} User data object
 */
function createUserData(overrides = {}) {
  const baseData = {
    username: generateUniqueUsername(),
    email: generateUniqueEmail(),
    password: 'ValidPass123!',
    role: 'admin',
    status: 'active',
    ...overrides
  };

  // Auto-add department for department role users if not explicitly set
  if (baseData.role === 'department' && !baseData.department) {
    const departments = ['IT Support', 'General Support', 'Human Resources', 'Finance', 'Facilities'];
    baseData.department = departments[Math.floor(Math.random() * departments.length)];
  }

  // Ensure non-department roles don't have department set
  if (baseData.role !== 'department' && baseData.department === undefined) {
    baseData.department = null;
  }

  return baseData;
}

/**
 * Create ticket test data with sensible defaults
 * @param {Object} overrides - Override default values
 * @returns {Object} Ticket data object
 */
function createTicketData(overrides = {}) {
  const departments = ['IT Support', 'General Support', 'Human Resources', 'Finance', 'Facilities'];
  const desks = ['Director', 'Manager', 'Nursing Station', 'Doctors office', 'Secretary'];

  return {
    title: `Test Ticket ${Date.now()}`,
    description: 'This is a test ticket description with enough detail to be meaningful.',
    reporter_department: departments[Math.floor(Math.random() * departments.length)],
    reporter_desk: desks[Math.floor(Math.random() * desks.length)],
    reporter_phone: '+1234567890',
    priority: 'unset',  // Default to 'unset' (department users cannot set priority)
    status: 'open',
    ...overrides
  };
}

/**
 * Create comment test data with sensible defaults
 * @param {Object} overrides - Override default values
 * @returns {Object} Comment data object
 */
function createCommentData(overrides = {}) {
  return {
    ticket_id: 1,
    user_id: 1,
    content: 'This is a test comment with meaningful content.',
    ...overrides
  };
}

/**
 * Create audit log test data with sensible defaults
 * @param {Object} overrides - Override default values
 * @returns {Object} Audit log data object
 */
function createAuditLogData(overrides = {}) {
  return {
    actor_id: 1,
    action: 'TEST_ACTION',
    target_type: 'user',
    target_id: 1,
    details: { test: true },
    ip_address: '127.0.0.1',
    ...overrides
  };
}

module.exports = {
  generateUniqueEmail,
  generateUniqueUsername,
  createUserData,
  createTicketData,
  createCommentData,
  createAuditLogData
};
