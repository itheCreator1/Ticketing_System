/**
 * Custom Jest Matchers
 *
 * Domain-specific assertions that make tests more readable and maintainable.
 * These matchers are automatically loaded by tests/setup.js
 */

expect.extend({
  /**
   * Check if an object is a valid ticket
   */
  toBeValidTicket(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      typeof received.id === 'number' &&
      typeof received.title === 'string' &&
      typeof received.description === 'string' &&
      ['open', 'in_progress', 'closed'].includes(received.status) &&
      ['low', 'medium', 'high', 'critical'].includes(received.priority);

    return {
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid ticket`
          : `expected ${JSON.stringify(received)} to be a valid ticket with id, title, description, valid status, and valid priority`,
      pass
    };
  },

  /**
   * Check if an object is a valid user
   */
  toBeValidUser(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      typeof received.id === 'number' &&
      typeof received.username === 'string' &&
      typeof received.email === 'string' &&
      ['admin', 'super_admin'].includes(received.role) &&
      ['active', 'inactive', 'deleted'].includes(received.status);

    return {
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid user`
          : `expected ${JSON.stringify(received)} to be a valid user with id, username, email, valid role, and valid status`,
      pass
    };
  },

  /**
   * Check if an object is a valid comment
   */
  toBeValidComment(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      typeof received.id === 'number' &&
      typeof received.ticket_id === 'number' &&
      typeof received.user_id === 'number' &&
      typeof received.content === 'string';

    return {
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid comment`
          : `expected ${JSON.stringify(received)} to be a valid comment with id, ticket_id, user_id, and content`,
      pass
    };
  },

  /**
   * Check if an object has valid timestamps
   */
  toHaveValidTimestamps(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      received.created_at instanceof Date &&
      !isNaN(received.created_at.getTime()) &&
      (received.updated_at === undefined ||
       (received.updated_at instanceof Date && !isNaN(received.updated_at.getTime())));

    return {
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to have valid timestamps`
          : `expected ${JSON.stringify(received)} to have valid created_at and optional updated_at timestamps`,
      pass
    };
  },

  /**
   * Check if a user is active
   */
  toBeActiveUser(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      received.status === 'active';

    return {
      message: () =>
        pass
          ? `expected user ${JSON.stringify(received)} not to be active`
          : `expected user ${JSON.stringify(received)} to have status='active'`,
      pass
    };
  },

  /**
   * Check if an account is locked (login_attempts >= 5)
   */
  toBeLockedAccount(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      typeof received.login_attempts === 'number' &&
      received.login_attempts >= 5;

    return {
      message: () =>
        pass
          ? `expected account ${JSON.stringify(received)} not to be locked`
          : `expected account ${JSON.stringify(received)} to have login_attempts >= 5`,
      pass
    };
  }
});
