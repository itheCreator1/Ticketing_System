const VALIDATION_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  DESCRIPTION_REQUIRED: 'Description is required',
  EMAIL_INVALID: 'Valid email is required',
  EMAIL_REQUIRED: 'Email is required',
  NAME_REQUIRED: 'Name is required',
  PRIORITY_INVALID: 'Invalid priority',
  STATUS_INVALID: 'Invalid status',
  USERNAME_REQUIRED: 'Username is required',
  PASSWORD_REQUIRED: 'Password is required',
  COMMENT_REQUIRED: 'Comment cannot be empty',
  // User management validation messages
  USERNAME_INVALID: 'Username must be 3-50 characters and contain only letters, numbers, and underscores',
  EMAIL_IN_USE: 'Email is already in use',
  USERNAME_IN_USE: 'Username is already in use',
  ROLE_INVALID: 'Invalid role selected',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
  PASSWORD_COMPLEXITY: 'Password must contain uppercase, lowercase, number, and special character'
};

module.exports = {
  VALIDATION_MESSAGES
};
