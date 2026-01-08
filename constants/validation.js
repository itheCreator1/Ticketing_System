const MAX_LENGTHS = {
  TICKET_TITLE: 200,
  TICKET_DESCRIPTION: 5000,
  COMMENT_CONTENT: 2000,
  PHONE_NUMBER: 20,
  USERNAME: 50,
  EMAIL: 100,
  NAME: 100,
  DEPARTMENT: 100
};

const VALIDATION_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: `Title cannot exceed ${MAX_LENGTHS.TICKET_TITLE} characters`,
  DESCRIPTION_REQUIRED: 'Description is required',
  DESCRIPTION_TOO_LONG: `Description cannot exceed ${MAX_LENGTHS.TICKET_DESCRIPTION} characters`,
  EMAIL_INVALID: 'Valid email is required',
  EMAIL_REQUIRED: 'Email is required',
  NAME_REQUIRED: 'Name is required',
  NAME_TOO_LONG: `Name cannot exceed ${MAX_LENGTHS.NAME} characters`,
  PHONE_TOO_LONG: `Phone number cannot exceed ${MAX_LENGTHS.PHONE_NUMBER} characters`,
  DEPARTMENT_REQUIRED: 'Department is required',
  DEPARTMENT_INVALID: 'Invalid department selected',
  PRIORITY_INVALID: 'Invalid priority',
  STATUS_INVALID: 'Invalid status',
  USERNAME_REQUIRED: 'Username is required',
  PASSWORD_REQUIRED: 'Password is required',
  COMMENT_REQUIRED: 'Comment cannot be empty',
  COMMENT_TOO_LONG: `Comment cannot exceed ${MAX_LENGTHS.COMMENT_CONTENT} characters`,
  // User management validation messages
  USERNAME_INVALID: 'Username must be 3-50 characters and contain only letters, numbers, and underscores',
  EMAIL_IN_USE: 'Email is already in use',
  USERNAME_IN_USE: 'Username is already in use',
  ROLE_INVALID: 'Invalid role selected',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
  PASSWORD_COMPLEXITY: 'Password must contain uppercase, lowercase, number, and special character'
};

module.exports = {
  VALIDATION_MESSAGES,
  MAX_LENGTHS
};
