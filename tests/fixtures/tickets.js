/**
 * Ticket Test Fixtures
 *
 * Static test data for tickets. Use these for reference data that doesn't
 * need to be unique (e.g., testing validation rules).
 */

module.exports = {
  validTicket: {
    title: 'Valid Test Ticket',
    description: 'This is a valid ticket description with adequate detail.',
    reporter_name: 'John Doe',
    reporter_department: 'IT Support',
    reporter_phone: '+1234567890',
    priority: 'medium',
    status: 'open'
  },

  urgentTicket: {
    title: 'Urgent Production Issue',
    description: 'Production system is down and users cannot access the application.',
    reporter_name: 'Jane Smith',
    reporter_department: 'IT Support',
    reporter_phone: '+1987654321',
    priority: 'critical',
    status: 'open'
  },

  closedTicket: {
    title: 'Resolved Issue',
    description: 'This issue has been resolved and closed.',
    reporter_name: 'Bob Johnson',
    reporter_department: 'General Support',
    priority: 'low',
    status: 'closed'
  },

  // Valid status values
  validStatuses: ['open', 'in_progress', 'closed'],

  // Invalid status values
  invalidStatuses: ['pending', 'archived', 'resolved', '', null, undefined, 123],

  // Valid priority values
  validPriorities: ['low', 'medium', 'high', 'critical'],

  // Invalid priority values
  invalidPriorities: ['urgent', 'normal', '', null, undefined, 123],

  // Valid department values
  validDepartments: ['IT Support', 'General Support', 'Human Resources', 'Finance', 'Facilities'],

  // Invalid department values
  invalidDepartments: ['Invalid Dept', 'Engineering', '', null, undefined, 123],

  // Invalid titles (for validation testing)
  invalidTitles: [
    '',                           // Empty
    'a',                          // Too short
    'a'.repeat(201),              // Exceeds MAX_LENGTHS.TICKET_TITLE (200)
    null,
    undefined
  ],

  // Invalid descriptions (for validation testing)
  invalidDescriptions: [
    '',                           // Empty
    'a'.repeat(5001),             // Exceeds MAX_LENGTHS.TICKET_DESCRIPTION (5000)
    null,
    undefined
  ]
};
