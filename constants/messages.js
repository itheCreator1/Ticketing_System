const FLASH_KEYS = {
  SUCCESS: 'success_msg',
  ERROR: 'error_msg',
  WARNING: 'warning_msg',
  INFO: 'error'
};

const AUTH_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  LOGIN_FAILED: 'Invalid username or password',
  LOGOUT_SUCCESS: 'You have been logged out',
  UNAUTHORIZED: 'Please log in to access this page',
  FORBIDDEN: 'You do not have permission to access this page'
};

const TICKET_MESSAGES = {
  CREATED: 'Your ticket has been submitted successfully!',
  UPDATED: 'Ticket updated successfully',
  NOT_FOUND: 'Ticket not found'
};

const COMMENT_MESSAGES = {
  ADDED: 'Comment added successfully'
};

module.exports = {
  FLASH_KEYS,
  AUTH_MESSAGES,
  TICKET_MESSAGES,
  COMMENT_MESSAGES
};
