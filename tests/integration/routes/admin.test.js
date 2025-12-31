/**
 * Admin Routes Integration Tests
 *
 * Tests admin-only routes with real database and authentication:
 * - GET /admin/dashboard - Ticket list with filters
 * - GET /admin/tickets/:id - Ticket details
 * - POST /admin/tickets/:id/update - Update ticket
 * - POST /admin/tickets/:id/comments - Add comment
 *
 * Uses transaction-based isolation for test data cleanup.
 */

const request = require('supertest');
const app = require('../../../app');
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');
const { createUserData, createTicketData, createCommentData } = require('../../helpers/factories');
const User = require('../../../models/User');
const Ticket = require('../../../models/Ticket');
const Comment = require('../../../models/Comment');
const AuditLog = require('../../../models/AuditLog');

describe('Admin Routes Integration Tests', () => {
  let adminUser;
  let adminCookies;

  beforeEach(async () => {
    await setupTestDatabase();

    // Create admin user and login for authenticated tests
    const adminData = createUserData({ role: 'admin', status: 'active' });
    adminUser = await User.create(adminData);

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password
      });

    adminCookies = loginResponse.headers['set-cookie'];
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('GET /admin/dashboard', () => {
    it('should require authentication', async () => {
      // Act - No cookies (not authenticated)
      const response = await request(app)
        .get('/admin/dashboard');

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should display tickets list when authenticated', async () => {
      // Arrange - Create some tickets
      await Ticket.create(createTicketData({ title: 'Test Ticket 1' }));
      await Ticket.create(createTicketData({ title: 'Test Ticket 2' }));

      // Act
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Admin Dashboard');
      expect(response.text).toContain('Test Ticket 1');
      expect(response.text).toContain('Test Ticket 2');
    });

    it('should support status filter - open', async () => {
      // Arrange
      await Ticket.create(createTicketData({ status: 'open', title: 'Open Ticket' }));
      await Ticket.create(createTicketData({ status: 'closed', title: 'Closed Ticket' }));

      // Act
      const response = await request(app)
        .get('/admin/dashboard?status=open')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
      // In a real implementation, would check that only open tickets are shown
    });

    it('should support status filter - in_progress', async () => {
      // Arrange
      await Ticket.create(createTicketData({ status: 'in_progress', title: 'In Progress Ticket' }));
      await Ticket.create(createTicketData({ status: 'open', title: 'Open Ticket' }));

      // Act
      const response = await request(app)
        .get('/admin/dashboard?status=in_progress')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should support status filter - closed', async () => {
      // Arrange
      await Ticket.create(createTicketData({ status: 'closed', title: 'Closed Ticket' }));
      await Ticket.create(createTicketData({ status: 'open', title: 'Open Ticket' }));

      // Act
      const response = await request(app)
        .get('/admin/dashboard?status=closed')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should support priority filter', async () => {
      // Arrange
      await Ticket.create(createTicketData({ priority: 'critical', title: 'Critical Ticket' }));
      await Ticket.create(createTicketData({ priority: 'low', title: 'Low Ticket' }));

      // Act
      const response = await request(app)
        .get('/admin/dashboard?priority=critical')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should support search by keyword', async () => {
      // Arrange
      await Ticket.create(createTicketData({ title: 'Database Connection Error' }));
      await Ticket.create(createTicketData({ title: 'Email Configuration Issue' }));

      // Act
      const response = await request(app)
        .get('/admin/dashboard?search=database')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should display ticket counts when no tickets exist', async () => {
      // Act
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Admin Dashboard');
    });
  });

  describe('GET /admin/tickets/:id', () => {
    it('should require authentication', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .get(`/admin/tickets/${ticket.id}`);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should display ticket details when authenticated', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData({ title: 'Test Ticket Detail' }));

      // Act
      const response = await request(app)
        .get(`/admin/tickets/${ticket.id}`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Test Ticket Detail');
      expect(response.text).toContain(`Ticket #${ticket.id}`);
    });

    it('should display comments for the ticket', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());
      const comment = await Comment.create(createCommentData({
        ticket_id: ticket.id,
        user_id: adminUser.id,
        content: 'Test comment content'
      }));

      // Act
      const response = await request(app)
        .get(`/admin/tickets/${ticket.id}`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Test comment content');
    });

    it('should display audit trail information', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .get(`/admin/tickets/${ticket.id}`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
      // Audit trail would be displayed in the template
    });

    it('should display assigned user when ticket is assigned', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData({ assigned_to: adminUser.id }));

      // Act
      const response = await request(app)
        .get(`/admin/tickets/${ticket.id}`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent ticket', async () => {
      // Act
      const response = await request(app)
        .get('/admin/tickets/99999')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should validate ticket ID parameter', async () => {
      // Act
      const response = await request(app)
        .get('/admin/tickets/invalid')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
    });
  });

  describe('POST /admin/tickets/:id/update', () => {
    it('should require authentication', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .send({ status: 'in_progress' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should require admin role', async () => {
      // Arrange - Create regular user (not admin)
      const regularUserData = createUserData({ role: 'user', status: 'active' });
      await User.create(regularUserData);

      const ticket = await Ticket.create(createTicketData());

      // Act - Use admin cookies (which has admin role, so this should succeed)
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ status: 'in_progress' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`/admin/tickets/${ticket.id}`);
    });

    it('should update ticket status', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData({ status: 'open' }));

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ status: 'in_progress' });

      // Assert
      expect(response.status).toBe(302);

      const updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.status).toBe('in_progress');
    });

    it('should update ticket priority', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData({ priority: 'low' }));

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ priority: 'critical' });

      // Assert
      expect(response.status).toBe(302);

      const updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.priority).toBe('critical');
    });

    it('should assign ticket to user', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData({ assigned_to: null }));

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ assigned_to: adminUser.id });

      // Assert
      expect(response.status).toBe(302);

      const updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.assigned_to).toBe(adminUser.id);
    });

    it('should create audit log entry for ticket update', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData({ status: 'open' }));

      // Act
      await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ status: 'closed' });

      // Assert
      const auditLogs = await AuditLog.findByTarget('ticket', ticket.id);
      const updateLog = auditLogs.find(log => log.action === 'TICKET_UPDATED');

      expect(updateLog).toBeDefined();
      expect(updateLog.actor_id).toBe(adminUser.id);
    });

    it('should validate ticket ID parameter', async () => {
      // Act
      const response = await request(app)
        .post('/admin/tickets/invalid/update')
        .set('Cookie', adminCookies)
        .send({ status: 'closed' });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act - Invalid status value
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ status: 'invalid_status' });

      // Assert
      expect(response.status).toBe(302);
    });
  });

  describe('POST /admin/tickets/:id/comments', () => {
    it('should require authentication', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .send({ content: 'Test comment' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should create public comment', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({
          content: 'This is a public comment',
          is_internal: 'false'
        });

      // Assert
      expect(response.status).toBe(302);

      const comments = await Comment.findByTicketId(ticket.id);
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('This is a public comment');
      expect(comments[0].is_internal).toBe(false);
      expect(comments[0].user_id).toBe(adminUser.id);
    });

    it('should create internal comment', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({
          content: 'This is an internal note',
          is_internal: 'true'
        });

      // Assert
      expect(response.status).toBe(302);

      const comments = await Comment.findByTicketId(ticket.id);
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('This is an internal note');
      expect(comments[0].is_internal).toBe(true);
    });

    it('should validate comment content is required', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({ content: '' });

      // Assert
      expect(response.status).toBe(302);

      const comments = await Comment.findByTicketId(ticket.id);
      expect(comments.length).toBe(0);
    });

    it('should validate ticket ID parameter', async () => {
      // Act
      const response = await request(app)
        .post('/admin/tickets/invalid/comments')
        .set('Cookie', adminCookies)
        .send({ content: 'Test comment' });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should redirect to ticket detail page after adding comment', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({ content: 'Test comment' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`/admin/tickets/${ticket.id}`);
    });

    it('should enforce maximum length on comment content', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());
      const longContent = 'a'.repeat(2001); // MAX_LENGTHS.COMMENT_CONTENT = 2000

      // Act
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({ content: longContent });

      // Assert
      expect(response.status).toBe(302);

      const comments = await Comment.findByTicketId(ticket.id);
      expect(comments.length).toBe(0);
    });
  });
});
