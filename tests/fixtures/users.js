/**
 * User Test Fixtures
 *
 * Static test data for users. Use these for reference data that doesn't
 * need to be unique (e.g., testing validation rules).
 */

module.exports = {
  validAdminUser: {
    username: 'testadmin',
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'admin',
    status: 'active'
  },

  validSuperAdmin: {
    username: 'testsuperadmin',
    email: 'superadmin@test.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    status: 'active'
  },

  validDepartmentUser: {
    username: 'testdeptuser',
    email: 'deptuser@test.com',
    password: 'DeptUser123!',
    role: 'department',
    status: 'active',
    department: 'IT Support'
  },

  inactiveUser: {
    username: 'inactiveuser',
    email: 'inactive@test.com',
    password: 'Inactive123!',
    role: 'admin',
    status: 'inactive'
  },

  deletedUser: {
    username: 'deleteduser',
    email: 'deleted@test.com',
    password: 'Deleted123!',
    role: 'admin',
    status: 'deleted'
  },

  // Invalid passwords for testing password validation
  invalidPasswords: [
    'short',           // Too short (< 8 characters)
    'nouppercase1!',   // No uppercase letter
    'NOLOWERCASE1!',   // No lowercase letter
    'NoNumber!',       // No number
    'NoSpecial123',    // No special character
    '',                // Empty
    'a'.repeat(200)    // Too long (exceeds reasonable limits)
  ],

  // Valid passwords for testing password validation
  validPasswords: [
    'ValidPass123!',
    'Test@Pass1',
    'Secure#2024',
    'MyP@ssw0rd',
    'Strong!Pass9'
  ]
};
