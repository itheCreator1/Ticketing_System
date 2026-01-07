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
  SECRETARY: 'Secretary',
  NOT_SPECIFIED: 'Not Specified'
};

const COMMENT_VISIBILITY = {
  PUBLIC: 'public',
  INTERNAL: 'internal'
};

module.exports = {
  TICKET_STATUS,
  TICKET_PRIORITY,
  USER_ROLE,
  USER_STATUS,
  REPORTER_DEPARTMENT,
  REPORTER_DESK,
  COMMENT_VISIBILITY
};
