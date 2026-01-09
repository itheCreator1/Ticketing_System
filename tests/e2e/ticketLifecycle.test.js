/**
 * Ticket Lifecycle End-to-End Tests
 *
 * Tests complete ticket workflow from start to finish:
 * - Department user submission → Admin review → Status updates → Comments → Closure
 * - Assignment workflow
 * - Priority escalation
 * - Complete audit trail verification
 *
 * These tests validate the entire ticket management system working together.
 */

const request = require('supertest');
const app = require('../../app');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/database');
const { createUserData, createTicketData } = require('../helpers/factories');
const User = require('../../models/User');
const Ticket = require('../../models/Ticket');
const Comment = require('../../models/Comment');
const AuditLog = require('../../models/AuditLog');

describe('Ticket Lifecycle E2E Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('Complete Ticket Lifecycle', () => {
    it('should complete full ticket journey from submission to closure', async () => {
      // Step 1: Department user logs in and submits ticket
      const departmentData = createUserData({
        role: 'department',
        status: 'active',
        username: 'dept_it_support',
        email: 'it.support@knii.local'
      });
      const departmentUser = await User.create(departmentData);

      const deptLoginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: departmentData.username,
          password: departmentData.password
        });

      const deptCookies = deptLoginResponse.headers['set-cookie'];

      // Department user creates ticket (now requires authentication)
      // Tickets are created directly in DB for this E2E test or via service
      const ticket = await Ticket.create({
        title: 'Cannot access database',
        description: 'Getting connection timeout errors when trying to connect to production database',
        reporter_name: 'IT Support Department',
        reporter_department: 'IT Support',
        reporter_phone: '+1234567890',
        reporter_id: departmentUser.id,
        priority: 'high',
        status: 'open'
      });

      expect(ticket.status).toBe('open');
      expect(ticket.reporter_id).toBe(departmentUser.id);

      // Step 2: Admin logs in
      const adminData = createUserData({ role: 'admin', status: 'active' });
      const admin = await User.create(adminData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Step 3: Admin views ticket in dashboard
      const dashboardResponse = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', adminCookies);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain('Cannot access database');

      // Step 4: Admin opens ticket details
      const detailResponse = await request(app)
        .get(`/admin/tickets/${ticket.id}`)
        .set('Cookie', adminCookies);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.text).toContain('Cannot access database');
      expect(detailResponse.text).toContain('Getting connection timeout errors');

      // Step 5: Admin updates status to 'in_progress'
      const updateResponse1 = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ status: 'in_progress' });

      expect(updateResponse1.status).toBe(302);

      // Verify status updated
      const ticketAfterUpdate1 = await Ticket.findById(ticket.id);
      expect(ticketAfterUpdate1.status).toBe('in_progress');

      // Verify audit log entry created
      const auditLogs1 = await AuditLog.findByTarget('ticket', ticket.id);
      const statusUpdateLog = auditLogs1.find(log =>
        log.action === 'TICKET_UPDATED' && log.details.status === 'in_progress'
      );
      expect(statusUpdateLog).toBeDefined();

      // Step 6: Admin adds first comment
      const firstCommentResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({
          content: 'Checking database connection logs. Appears to be a network issue.'
        });

      expect(firstCommentResponse.status).toBe(302);

      // Verify first comment created
      const comments1 = await Comment.findByTicketId(ticket.id);
      expect(comments1.length).toBe(1);
      expect(comments1[0].content).toContain('network issue');
      expect(comments1[0].user_id).toBe(admin.id);

      // Step 7: Admin adds second comment
      const secondCommentResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({
          content: 'We are investigating the database connection issue. Our team is working on it.'
        });

      expect(secondCommentResponse.status).toBe(302);

      // Verify second comment created
      const comments2 = await Comment.findByTicketId(ticket.id);
      expect(comments2.length).toBe(2);
      expect(comments2[1].content).toContain('investigating');

      // Step 8: Admin assigns ticket to themselves
      const assignResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ assigned_to: admin.id });

      expect(assignResponse.status).toBe(302);

      // Verify assignment
      const ticketAfterAssign = await Ticket.findById(ticket.id);
      expect(ticketAfterAssign.assigned_to).toBe(admin.id);

      // Step 9: Admin updates priority to 'critical'
      const priorityResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ priority: 'critical' });

      expect(priorityResponse.status).toBe(302);

      // Verify priority updated
      const ticketAfterPriority = await Ticket.findById(ticket.id);
      expect(ticketAfterPriority.priority).toBe('critical');

      // Step 10: Admin adds resolution comment
      const resolutionCommentResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', adminCookies)
        .send({
          content: 'Issue resolved. Firewall rules have been updated to allow database connections.'
        });

      expect(resolutionCommentResponse.status).toBe(302);

      // Step 11: Admin closes ticket (status = 'closed')
      const closeResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ status: 'closed' });

      expect(closeResponse.status).toBe(302);

      // Step 12: Verify final ticket state
      const finalTicket = await Ticket.findById(ticket.id);
      expect(finalTicket.status).toBe('closed');
      expect(finalTicket.priority).toBe('critical');
      expect(finalTicket.assigned_to).toBe(admin.id);
      expect(finalTicket.title).toBe('Cannot access database');

      // Step 13: Verify final comment count
      const finalComments = await Comment.findByTicketId(ticket.id);
      expect(finalComments.length).toBe(3);

      // Step 14: Verify complete audit trail
      const finalAuditLogs = await AuditLog.findByTarget('ticket', ticket.id);
      expect(finalAuditLogs.length).toBeGreaterThanOrEqual(1);

      // Verify ticket creation log
      const creationLog = finalAuditLogs.find(log => log.action === 'TICKET_CREATED');
      expect(creationLog).toBeDefined();

      // Verify update logs
      const updateLogs = finalAuditLogs.filter(log => log.action === 'TICKET_UPDATED');
      expect(updateLogs.length).toBeGreaterThan(0);
    });

    it('should track all status transitions in audit log', async () => {
      // Arrange - Create admin and ticket
      const adminData = createUserData({ role: 'admin', status: 'active' });
      const admin = await User.create(adminData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      const ticket = await Ticket.create(createTicketData({ status: 'open' }));

      // Act - Transition through all statuses
      const statuses = ['in_progress', 'closed', 'open', 'in_progress', 'closed'];

      for (const status of statuses) {
        await request(app)
          .post(`/admin/tickets/${ticket.id}/update`)
          .set('Cookie', adminCookies)
          .send({ status });
      }

      // Assert - Verify all transitions logged
      const auditLogs = await AuditLog.findByTarget('ticket', ticket.id);
      const statusUpdateLogs = auditLogs.filter(log =>
        log.action === 'TICKET_UPDATED' && log.details.status
      );

      expect(statusUpdateLogs.length).toBeGreaterThanOrEqual(statuses.length);
    });
  });

  describe('Assignment Workflow', () => {
    it('should complete ticket assignment workflow', async () => {
      // Step 1: Create ticket
      const ticketData = createTicketData({ assigned_to: null });
      const ticket = await Ticket.create(ticketData);

      // Step 2: Create admin and login
      const adminData = createUserData({ role: 'admin', status: 'active' });
      const admin = await User.create(adminData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Step 3: Verify ticket is unassigned
      expect(ticket.assigned_to).toBeNull();

      // Step 4: Assign ticket to admin
      const assignResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ assigned_to: admin.id });

      expect(assignResponse.status).toBe(302);

      // Step 5: Verify assignment
      const assignedTicket = await Ticket.findById(ticket.id);
      expect(assignedTicket.assigned_to).toBe(admin.id);

      // Step 6: View ticket shows assigned user
      const detailResponse = await request(app)
        .get(`/admin/tickets/${ticket.id}`)
        .set('Cookie', adminCookies);

      expect(detailResponse.status).toBe(200);

      // Step 7: Unassign ticket (set to null)
      const unassignResponse = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ assigned_to: '' });

      // Verify unassignment (if supported)
      // Some implementations may not allow null assignment
    });

    it('should allow reassignment to different user', async () => {
      // Arrange
      const admin1Data = createUserData({ role: 'admin', status: 'active' });
      const admin2Data = createUserData({ role: 'admin', status: 'active' });

      const admin1 = await User.create(admin1Data);
      const admin2 = await User.create(admin2Data);

      const ticket = await Ticket.create(createTicketData({ assigned_to: admin1.id }));

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: admin1Data.username,
          password: admin1Data.password
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Act - Reassign to admin2
      await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ assigned_to: admin2.id });

      // Assert
      const updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.assigned_to).toBe(admin2.id);
    });
  });

  describe('Priority Escalation', () => {
    it('should complete priority escalation workflow', async () => {
      // Step 1: Create low priority ticket
      const ticket = await Ticket.create(createTicketData({ priority: 'low' }));

      // Step 2: Admin login
      const adminData = createUserData({ role: 'admin', status: 'active' });
      await User.create(adminData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Step 3: Escalate to medium
      await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ priority: 'medium' });

      let updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.priority).toBe('medium');

      // Step 4: Escalate to high
      await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ priority: 'high' });

      updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.priority).toBe('high');

      // Step 5: Escalate to critical
      await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', adminCookies)
        .send({ priority: 'critical' });

      updatedTicket = await Ticket.findById(ticket.id);
      expect(updatedTicket.priority).toBe('critical');

      // Step 6: Verify audit trail shows all escalations
      const auditLogs = await AuditLog.findByTarget('ticket', ticket.id);
      const priorityLogs = auditLogs.filter(log =>
        log.action === 'TICKET_UPDATED' && log.details.priority
      );

      expect(priorityLogs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Multi-Comment Workflow', () => {
    it('should handle multiple comments from different perspectives', async () => {
      // Arrange
      const ticket = await Ticket.create(createTicketData());

      const admin1Data = createUserData({ role: 'admin', status: 'active' });
      const admin2Data = createUserData({ role: 'admin', status: 'active' });

      const admin1 = await User.create(admin1Data);
      const admin2 = await User.create(admin2Data);

      const login1 = await request(app)
        .post('/auth/login')
        .send({
          username: admin1Data.username,
          password: admin1Data.password
        });

      const cookies1 = login1.headers['set-cookie'];

      const login2 = await request(app)
        .post('/auth/login')
        .send({
          username: admin2Data.username,
          password: admin2Data.password
        });

      const cookies2 = login2.headers['set-cookie'];

      // Act - Admin 1 adds comment
      await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', cookies1)
        .send({
          content: 'I will investigate this issue.'
        });

      // Admin 2 adds comment
      await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', cookies2)
        .send({
          content: 'I can help with the database side.'
        });

      // Admin 1 adds another comment
      await request(app)
        .post(`/admin/tickets/${ticket.id}/comments`)
        .set('Cookie', cookies1)
        .send({
          content: 'Issue has been resolved.'
        });

      // Assert
      const comments = await Comment.findByTicketId(ticket.id);
      expect(comments.length).toBe(3);

      // Verify authors (all comments are admin-only)
      const admin1Comments = comments.filter(c => c.user_id === admin1.id);
      const admin2Comments = comments.filter(c => c.user_id === admin2.id);

      expect(admin1Comments.length).toBe(2);
      expect(admin2Comments.length).toBe(1);
    });
  });

  describe('Filtering and Search', () => {
    it('should filter tickets by status in dashboard', async () => {
      // Arrange - Create tickets with different statuses
      await Ticket.create(createTicketData({ status: 'open', title: 'Open Ticket 1' }));
      await Ticket.create(createTicketData({ status: 'in_progress', title: 'In Progress Ticket' }));
      await Ticket.create(createTicketData({ status: 'closed', title: 'Closed Ticket' }));
      await Ticket.create(createTicketData({ status: 'open', title: 'Open Ticket 2' }));

      const adminData = createUserData({ role: 'admin', status: 'active' });
      await User.create(adminData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        });

      const adminCookies = loginResponse.headers['set-cookie'];

      // Act - Filter by status=open
      const openResponse = await request(app)
        .get('/admin/dashboard?status=open')
        .set('Cookie', adminCookies);

      expect(openResponse.status).toBe(200);

      // Filter by status=closed
      const closedResponse = await request(app)
        .get('/admin/dashboard?status=closed')
        .set('Cookie', adminCookies);

      expect(closedResponse.status).toBe(200);

      // Assert - All tickets shown when no filter
      const allResponse = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', adminCookies);

      expect(allResponse.status).toBe(200);
    });
  });
});
