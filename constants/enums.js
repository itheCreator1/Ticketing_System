const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed'
};

const TICKET_PRIORITY = {
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

module.exports = {
  TICKET_STATUS,
  TICKET_PRIORITY,
  USER_ROLE,
  USER_STATUS
};
