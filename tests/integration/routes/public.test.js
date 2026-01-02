/**
 * Public Routes Integration Tests
 *
 * Tests public-facing routes with real database:
 * - GET / - Landing page with ticket submission form
 * - POST /submit-ticket - Public ticket creation
 * - GET /health - Health check endpoint
 *
 * Uses transaction-based isolation for test data cleanup.
 */

const request = require('supertest');
const app = require('../../../app');
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');
const { createTicketData } = require('../../helpers/factories');
const Ticket = require('../../../models/Ticket');
const AuditLog = require('../../../models/AuditLog');

describe('Public Routes Integration Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('GET /', () => {
    it('should render landing page with ticket submission form', async () => {
      // Act
      const response = await request(app)
        .get('/');

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Submit a Ticket');
      expect(response.text).toContain('title');
      expect(response.text).toContain('description');
      expect(response.text).toContain('reporter_name');
      expect(response.text).toContain('reporter_email');
    });

    it('should include CSRF token in form', async () => {
      // Act
      const response = await request(app)
        .get('/');

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('_csrf');
    });

    it('should display no errors by default', async () => {
      // Act
      const response = await request(app)
        .get('/');

      // Assert
      expect(response.status).toBe(200);
      // Check that errors array is empty or not shown
      expect(response.text).not.toContain('error-message');
    });
  });

  describe('POST /submit-ticket', () => {
    it('should create ticket with valid data', async () => {
      // Arrange
      const ticketData = createTicketData({
        title: 'Integration Test Ticket',
        description: 'This ticket was created by an integration test',
        reporter_name: 'John Doe',
        reporter_email: 'john@example.com',
        reporter_phone: '+1234567890'
      });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Ticket Submitted');

      // Verify ticket was created in database
      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      expect(tickets.length).toBe(1);
      expect(tickets[0].title).toBe(ticketData.title);
      expect(tickets[0].description).toBe(ticketData.description);
      expect(tickets[0].reporter_name).toBe(ticketData.reporter_name);
      expect(tickets[0].reporter_email).toBe(ticketData.reporter_email);
      expect(tickets[0].priority).toBe('unset'); // Default priority
      expect(tickets[0].status).toBe('open');
    });

    it('should validate required fields - title', async () => {
      // Arrange
      const ticketData = createTicketData({ title: '' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');

      // Verify no ticket was created
      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      expect(tickets.length).toBe(0);
    });

    it('should validate required fields - description', async () => {
      // Arrange
      const ticketData = createTicketData({ description: '' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should validate required fields - reporter_name', async () => {
      // Arrange
      const ticketData = createTicketData({ reporter_name: '' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should validate required fields - reporter_email', async () => {
      // Arrange
      const ticketData = createTicketData({ reporter_email: '' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should validate email format', async () => {
      // Arrange
      const ticketData = createTicketData({ reporter_email: 'invalid-email' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should accept optional reporter_phone field', async () => {
      // Arrange
      const ticketData = createTicketData({ reporter_phone: '' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(200);

      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      expect(tickets.length).toBe(1);
      expect(tickets[0].reporter_phone).toBeNull();
    });

    it('should default priority to unset when not specified', async () => {
      // Arrange
      const ticketData = createTicketData();
      delete ticketData.priority;

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(200);

      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      expect(tickets[0].priority).toBe('unset');
    });

    it('should accept valid priority values', async () => {
      // Test each valid priority
      const priorities = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        // Arrange
        const ticketData = createTicketData({ priority });

        // Act
        const response = await request(app)
          .post('/submit-ticket')
          .send(ticketData);

        // Assert
        expect(response.status).toBe(200);
      }
    });

    it('should create audit log entry for ticket creation', async () => {
      // Arrange
      const ticketData = createTicketData();

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      const ticketId = tickets[0].id;

      const auditLogs = await AuditLog.findByTarget('ticket', ticketId);
      expect(auditLogs.length).toBeGreaterThan(0);

      const creationLog = auditLogs.find(log => log.action === 'TICKET_CREATED');
      expect(creationLog).toBeDefined();
      expect(creationLog.target_type).toBe('ticket');
      expect(creationLog.target_id).toBe(ticketId);
    });

    it('should redirect to success page on successful submission', async () => {
      // Arrange
      const ticketData = createTicketData();

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Ticket Submitted');
      expect(response.text).toContain('ticket');
    });

    it('should handle validation errors with flash messages', async () => {
      // Arrange
      const ticketData = createTicketData({ title: '', description: '' });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
      // Flash messages are stored in session and would be displayed on redirect
    });

    it('should trim whitespace from input fields', async () => {
      // Arrange
      const ticketData = createTicketData({
        title: '  Trimmed Title  ',
        description: '  Trimmed Description  ',
        reporter_name: '  John Doe  '
      });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(200);

      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      expect(tickets[0].title).toBe('Trimmed Title');
      expect(tickets[0].description).toBe('Trimmed Description');
      expect(tickets[0].reporter_name).toBe('John Doe');
    });

    it('should enforce maximum length constraints', async () => {
      // Arrange
      const ticketData = createTicketData({
        title: 'a'.repeat(201), // MAX_LENGTHS.TICKET_TITLE = 200
        description: 'Valid description'
      });

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should create ticket with status open by default', async () => {
      // Arrange
      const ticketData = createTicketData();

      // Act
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert
      const tickets = await Ticket.findAll({ limit: 10, offset: 0 });
      expect(tickets[0].status).toBe('open');
      expect(tickets[0].assigned_to).toBeNull();
    });
  });

  describe('GET /health', () => {
    it('should return 200 status with health information', async () => {
      // Act
      const response = await request(app)
        .get('/health');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.environment).toBeDefined();
    });

    it('should include database status', async () => {
      // Act
      const response = await request(app)
        .get('/health');

      // Assert
      expect(response.body.database).toBeDefined();
      expect(response.body.database.status).toBe('connected');
      expect(response.body.database.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include memory usage information', async () => {
      // Act
      const response = await request(app)
        .get('/health');

      // Assert
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.heapUsed).toContain('MB');
      expect(response.body.memory.heapTotal).toContain('MB');
    });

    it('should return JSON format', async () => {
      // Act
      const response = await request(app)
        .get('/health');

      // Assert
      expect(response.headers['content-type']).toContain('application/json');
      expect(typeof response.body).toBe('object');
    });
  });
});
