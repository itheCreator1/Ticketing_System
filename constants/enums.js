const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
  WAITING_ON_ADMIN: 'waiting_on_admin',
  WAITING_ON_DEPARTMENT: 'waiting_on_department'
};

const TICKET_PRIORITY = {
  UNSET: 'unset',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const USER_ROLE = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  DEPARTMENT: 'department'
};

const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted'
};

/**
 * @deprecated Departments are now database-driven. Use Department.findAll() instead.
 * This constant is kept for backward compatibility only.
 *
 * Note: As of v2.5.0, the system uses hospital-specific departments seeded via
 * seed-hospital-data.js script. Default departments include: Emergency Department,
 * Cardiology, Radiology, Pharmacy, Laboratory, Surgery, Intensive Care Unit,
 * Patient Registration, Medical Records, and Facilities Management.
 *
 * See CLAUDE.md for migration instructions from generic to hospital departments.
 */
const REPORTER_DEPARTMENT = {
  IT_SUPPORT: 'IT Support',
  GENERAL_SUPPORT: 'General Support',
  HUMAN_RESOURCES: 'Human Resources',
  FINANCE: 'Finance',
  FACILITIES: 'Facilities',
  INTERNAL: 'Internal'
};

const COMMENT_VISIBILITY = {
  PUBLIC: 'public',
  INTERNAL: 'internal'
};

/**
 * Department floor values
 * Used for validation and dropdown options
 */
const DEPARTMENT_FLOOR = {
  BASEMENT: 'Basement',
  GROUND_FLOOR: 'Ground Floor',
  FIRST_FLOOR: '1st Floor',
  SECOND_FLOOR: '2nd Floor',
  THIRD_FLOOR: '3rd Floor',
  FOURTH_FLOOR: '4th Floor',
  FIFTH_FLOOR: '5th Floor',
  SIXTH_FLOOR: '6th Floor'
};

/**
 * Helper function to get all floor values as array
 * @returns {Array<string>} Array of valid floor values
 */
function getDepartmentFloors() {
  return Object.values(DEPARTMENT_FLOOR);
}

module.exports = {
  TICKET_STATUS,
  TICKET_PRIORITY,
  USER_ROLE,
  USER_STATUS,
  REPORTER_DEPARTMENT,
  COMMENT_VISIBILITY,
  DEPARTMENT_FLOOR,
  getDepartmentFloors
};
