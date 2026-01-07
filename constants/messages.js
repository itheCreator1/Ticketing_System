const FLASH_KEYS = {
  SUCCESS: 'success_msg',
  ERROR: 'error_msg'
};

const AUTH_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  LOGIN_FAILED: 'Invalid username or password',
  LOGOUT_SUCCESS: 'You have been logged out',
  UNAUTHORIZED: 'Please log in to access this page',
  FORBIDDEN: 'You do not have permission to access this page',
  SUPER_ADMIN_REQUIRED: 'Super admin access required'
};

const TICKET_MESSAGES = {
  CREATED: 'Your ticket has been submitted successfully!',
  UPDATED: 'Ticket updated successfully',
  NOT_FOUND: 'Ticket not found',
  UNAUTHORIZED_ACCESS: 'You do not have permission to access this ticket',
  STATUS_CHANGED: 'Ticket status updated successfully'
};

const COMMENT_MESSAGES = {
  ADDED: 'Comment added successfully'
};

const USER_MESSAGES = {
  CREATED: 'User created successfully',
  UPDATED: 'User updated successfully',
  DELETED: 'User deleted successfully',
  PASSWORD_RESET: 'Password reset successfully',
  STATUS_UPDATED: 'User status updated',
  NOT_FOUND: 'User not found',
  LOAD_FAILED: 'Failed to load user',
  CREATE_FAILED: 'Failed to create user',
  UPDATE_FAILED: 'Failed to update user',
  DELETE_FAILED: 'Failed to delete user',
  PASSWORD_RESET_FAILED: 'Failed to reset password',
  STATUS_UPDATE_FAILED: 'Failed to update status'
};

module.exports = {
  FLASH_KEYS,
  AUTH_MESSAGES,
  TICKET_MESSAGES,
  COMMENT_MESSAGES,
  USER_MESSAGES
};
