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
 * NOTE: DEPARTMENT_FLOOR constant was removed in v2.4.0
 * Floors are now fully database-driven and seeded via JSON configuration files.
 * Use Floor.findAll() to retrieve available floors at runtime.
 *
 * See docs/CUSTOMIZATION.md for information on customizing floors and departments.
 */

module.exports = {
  TICKET_STATUS,
  TICKET_PRIORITY,
  USER_ROLE,
  USER_STATUS,
  REPORTER_DEPARTMENT,
  COMMENT_VISIBILITY
};
