/**
 * Seed Configuration Validator
 *
 * Validates JSON configuration files (floors.json, departments.json) before seeding.
 * Provides comprehensive error collection for all validation issues.
 *
 * Usage:
 *   const validator = require('./utils/seedValidator');
 *   const errors = validator.validateConfig(floorsData, departmentsData);
 *   if (errors.length > 0) {
 *     console.error('Validation errors:', errors);
 *   }
 */

/**
 * Validates floor configuration
 * @param {Array} floors - Array of floor objects from floors.json
 * @returns {Array} Array of error messages (empty if valid)
 */
function validateFloors(floors) {
  const errors = [];

  if (!Array.isArray(floors)) {
    errors.push('Floors: Expected array of floor objects');
    return errors;
  }

  if (floors.length === 0) {
    errors.push('Floors: At least one floor is required');
    return errors;
  }

  const seenNames = new Set();
  const seenSortOrders = new Set();

  floors.forEach((floor, index) => {
    const prefix = `Floor[${index}]`;

    // Required field validation
    if (!floor.name) {
      errors.push(`${prefix}: Missing required field "name"`);
    } else if (typeof floor.name !== 'string') {
      errors.push(`${prefix}.name: Must be a string`);
    } else {
      // Name length validation
      if (floor.name.length < 2 || floor.name.length > 50) {
        errors.push(`${prefix}.name: Length must be between 2 and 50 characters`);
      }

      // Duplicate name detection
      if (seenNames.has(floor.name)) {
        errors.push(`${prefix}.name: Duplicate floor name "${floor.name}"`);
      } else {
        seenNames.add(floor.name);
      }
    }

    // sort_order validation
    if (floor.sort_order === undefined || floor.sort_order === null) {
      errors.push(`${prefix}: Missing required field "sort_order"`);
    } else if (!Number.isInteger(floor.sort_order)) {
      errors.push(`${prefix}.sort_order: Must be an integer`);
    } else if (floor.sort_order < 0) {
      errors.push(`${prefix}.sort_order: Must be >= 0`);
    } else {
      // Duplicate sort_order detection
      if (seenSortOrders.has(floor.sort_order)) {
        errors.push(`${prefix}.sort_order: Duplicate sort_order value ${floor.sort_order}`);
      } else {
        seenSortOrders.add(floor.sort_order);
      }
    }

    // active field validation (optional, defaults to true)
    if (floor.active !== undefined && typeof floor.active !== 'boolean') {
      errors.push(`${prefix}.active: Must be a boolean`);
    }
  });

  return errors;
}

/**
 * Validates department configuration
 * @param {Array} departments - Array of department objects from departments.json
 * @param {Array} floors - Array of floor names (for FK validation)
 * @returns {Array} Array of error messages (empty if valid)
 */
function validateDepartments(departments, floors) {
  const errors = [];

  if (!Array.isArray(departments)) {
    errors.push('Departments: Expected array of department objects');
    return errors;
  }

  if (departments.length === 0) {
    errors.push('Departments: At least one department is required (including Internal)');
    return errors;
  }

  const floorNames = floors.map((f) => f.name);
  const seenNames = new Set();
  const seenUsernames = new Set();
  const seenEmails = new Set();
  let internalDeptCount = 0;

  departments.forEach((dept, index) => {
    const prefix = `Department[${index}]`;

    // Required field validation
    if (!dept.name) {
      errors.push(`${prefix}: Missing required field "name"`);
    } else if (typeof dept.name !== 'string') {
      errors.push(`${prefix}.name: Must be a string`);
    } else {
      // Name length validation
      if (dept.name.length < 2 || dept.name.length > 100) {
        errors.push(`${prefix}.name: Length must be between 2 and 100 characters`);
      }

      // Duplicate name detection
      if (seenNames.has(dept.name)) {
        errors.push(`${prefix}.name: Duplicate department name "${dept.name}"`);
      } else {
        seenNames.add(dept.name);
      }

      // Track Internal department
      if (dept.name === 'Internal') {
        internalDeptCount++;
      }
    }

    // description validation (optional)
    if (dept.description && typeof dept.description !== 'string') {
      errors.push(`${prefix}.description: Must be a string`);
    }

    // floor validation
    if (!dept.floor) {
      errors.push(`${prefix}: Missing required field "floor"`);
    } else if (typeof dept.floor !== 'string') {
      errors.push(`${prefix}.floor: Must be a string`);
    } else if (!floorNames.includes(dept.floor)) {
      errors.push(`${prefix}.floor: Floor "${dept.floor}" does not exist in floors configuration`);
    }

    // Validate user object if present
    if (dept.user !== null && dept.user !== undefined) {
      validateDepartmentUser(dept.user, index, errors, seenUsernames, seenEmails);
    } else if (dept.name !== 'Internal') {
      errors.push(`${prefix}.user: User is required for non-Internal departments`);
    }
  });

  // Ensure Internal department exists
  if (internalDeptCount === 0) {
    errors.push('Departments: "Internal" department is required (system department)');
  } else if (internalDeptCount > 1) {
    errors.push('Departments: "Internal" department can only be defined once');
  }

  return errors;
}

/**
 * Validates a department user object
 * @param {Object} user - User object to validate
 * @param {Number} deptIndex - Department index for error messages
 * @param {Array} errors - Error array to append to
 * @param {Set} seenUsernames - Set of seen usernames
 * @param {Set} seenEmails - Set of seen emails
 */
function validateDepartmentUser(user, deptIndex, errors, seenUsernames, seenEmails) {
  const prefix = `Department[${deptIndex}].user`;

  if (typeof user !== 'object' || user === null || Array.isArray(user)) {
    errors.push(`${prefix}: Must be an object`);
    return;
  }

  // Required fields
  if (!user.username) {
    errors.push(`${prefix}: Missing required field "username"`);
  } else if (typeof user.username !== 'string') {
    errors.push(`${prefix}.username: Must be a string`);
  } else {
    // Username length validation
    if (user.username.length < 3 || user.username.length > 50) {
      errors.push(`${prefix}.username: Length must be between 3 and 50 characters`);
    }

    // Username format validation (alphanumeric, dots, underscores, hyphens)
    if (!/^[a-zA-Z0-9._-]+$/.test(user.username)) {
      errors.push(
        `${prefix}.username: Only alphanumeric characters, dots, underscores, and hyphens allowed`
      );
    }

    // Duplicate username detection
    if (seenUsernames.has(user.username)) {
      errors.push(`${prefix}.username: Duplicate username "${user.username}"`);
    } else {
      seenUsernames.add(user.username);
    }
  }

  if (!user.email) {
    errors.push(`${prefix}: Missing required field "email"`);
  } else if (typeof user.email !== 'string') {
    errors.push(`${prefix}.email: Must be a string`);
  } else {
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      errors.push(`${prefix}.email: Invalid email format "${user.email}"`);
    } else if (user.email.length > 100) {
      errors.push(`${prefix}.email: Length must not exceed 100 characters`);
    }

    // Duplicate email detection
    if (seenEmails.has(user.email)) {
      errors.push(`${prefix}.email: Duplicate email "${user.email}"`);
    } else {
      seenEmails.add(user.email);
    }
  }

  if (!user.password) {
    errors.push(`${prefix}: Missing required field "password"`);
  } else if (typeof user.password !== 'string') {
    errors.push(`${prefix}.password: Must be a string`);
  } else if (user.password.length < 6) {
    errors.push(`${prefix}.password: Must be at least 6 characters`);
  }

  if (!user.full_name) {
    errors.push(`${prefix}: Missing required field "full_name"`);
  } else if (typeof user.full_name !== 'string') {
    errors.push(`${prefix}.full_name: Must be a string`);
  } else if (user.full_name.length < 2 || user.full_name.length > 100) {
    errors.push(`${prefix}.full_name: Length must be between 2 and 100 characters`);
  }
}

/**
 * Validates super admin configuration
 * @param {Object} superAdmin - Super admin object from departments.json
 * @returns {Array} Array of error messages (empty if valid)
 */
function validateSuperAdmin(superAdmin) {
  const errors = [];

  if (!superAdmin) {
    errors.push('SuperAdmin: Super admin configuration is required');
    return errors;
  }

  if (typeof superAdmin !== 'object' || Array.isArray(superAdmin)) {
    errors.push('SuperAdmin: Must be an object');
    return errors;
  }

  const prefix = 'SuperAdmin';

  // Required fields
  if (!superAdmin.username) {
    errors.push(`${prefix}: Missing required field "username"`);
  } else if (typeof superAdmin.username !== 'string') {
    errors.push(`${prefix}.username: Must be a string`);
  } else if (superAdmin.username.length < 3 || superAdmin.username.length > 50) {
    errors.push(`${prefix}.username: Length must be between 3 and 50 characters`);
  }

  if (!superAdmin.email) {
    errors.push(`${prefix}: Missing required field "email"`);
  } else if (typeof superAdmin.email !== 'string') {
    errors.push(`${prefix}.email: Must be a string`);
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(superAdmin.email)) {
      errors.push(`${prefix}.email: Invalid email format "${superAdmin.email}"`);
    }
  }

  if (!superAdmin.password) {
    errors.push(`${prefix}: Missing required field "password"`);
  } else if (typeof superAdmin.password !== 'string') {
    errors.push(`${prefix}.password: Must be a string`);
  } else if (superAdmin.password.length < 6) {
    errors.push(`${prefix}.password: Must be at least 6 characters`);
  }

  if (!superAdmin.full_name) {
    errors.push(`${prefix}: Missing required field "full_name"`);
  } else if (typeof superAdmin.full_name !== 'string') {
    errors.push(`${prefix}.full_name: Must be a string`);
  }

  return errors;
}

/**
 * Main validation function
 * Validates all configuration data before seeding
 *
 * @param {Object} floorsData - Parsed floors.json content
 * @param {Object} departmentsData - Parsed departments.json content
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
function validateConfig(floorsData, departmentsData) {
  const errors = [];

  // Validate floors.json structure
  if (!floorsData || !floorsData.floors) {
    errors.push('Floors.json: Missing "floors" array');
    return { valid: false, errors };
  }

  // Validate departments.json structure
  if (!departmentsData || !departmentsData.departments) {
    errors.push('Departments.json: Missing "departments" array');
    return { valid: false, errors };
  }

  // Validate floors
  const floorErrors = validateFloors(floorsData.floors);
  errors.push(...floorErrors);

  // Validate departments (include floors for FK validation)
  const departmentErrors = validateDepartments(departmentsData.departments, floorsData.floors);
  errors.push(...departmentErrors);

  // Validate super admin
  const superAdminErrors = validateSuperAdmin(departmentsData.super_admin);
  errors.push(...superAdminErrors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formats validation errors for display
 * @param {Array} errors - Array of error messages
 * @returns {String} Formatted error message
 */
function formatErrors(errors) {
  if (errors.length === 0) {
    return '';
  }

  const lines = ['❌ Configuration validation failed:\n'];

  errors.forEach((error) => {
    lines.push(`  - ${error}`);
  });

  lines.push('\nPlease fix the errors above and try again.');
  return lines.join('\n');
}

module.exports = {
  validateConfig,
  validateFloors,
  validateDepartments,
  validateSuperAdmin,
  formatErrors,
};
