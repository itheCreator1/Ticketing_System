const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed'
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
  SUPER_ADMIN: 'super_admin'
};

const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted'
};

const REPORTER_DEPARTMENT = {
  IT_SUPPORT: 'IT Support',
  GENERAL_SUPPORT: 'General Support',
  HUMAN_RESOURCES: 'Human Resources',
  FINANCE: 'Finance',
  FACILITIES: 'Facilities'
};

const REPORTER_DESK = {
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  NURSING_STATION: 'Nursing Station',
  DOCTORS_OFFICE: 'Doctors office',
  SECRETARY: 'Secretary'
};

module.exports = {
  TICKET_STATUS,
  TICKET_PRIORITY,
  USER_ROLE,
  USER_STATUS,
  REPORTER_DEPARTMENT,
  REPORTER_DESK
};
