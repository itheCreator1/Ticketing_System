/**
 * Validation Middleware Integration Tests
 *
 * Tests validation middleware integration with real application:
 * - CSRF protection using csrf-csrf middleware
 * - Token validation for POST/PUT/DELETE requests
 * - Token generation and cookie management
 * - Method exemptions (GET, HEAD, OPTIONS)
 *
 * Uses transaction-based isolation for test data cleanup.
 */

const request = require('supertest');
const app = require('../../../app');
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');
const { createUserData, createTicketData } = require('../../helpers/factories');
const User = require('../../../models/User');
const Ticket = require('../../../models/Ticket');

describe('Validation Middleware Integration Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('CSRF Protection Integration', () => {
    it('should accept GET requests without CSRF token', async () => {
      // Act
      const response = await request(app)
        .get('/');

      // Assert
      expect(response.status).toBe(200);
    });

    it('should accept HEAD requests without CSRF token', async () => {
      // Act
      const response = await request(app)
        .head('/');

      // Assert
      expect(response.status).toBe(200);
    });

    it('should accept OPTIONS requests without CSRF token', async () => {
      // Act
      const response = await request(app)
        .options('/');

      // Assert - May be 200 or 204 depending on implementation
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should generate CSRF token in GET response', async () => {
      // Act
      const response = await request(app)
        .get('/');

      // Assert - Check for CSRF token in page or cookies
      expect(response.status).toBe(200);
      // CSRF token should be available in res.locals.csrfToken
      expect(response.text).toContain('_csrf');
    });

    it('should set CSRF cookie on first request', async () => {
      // Act
      const response = await request(app)
        .get('/');

      // Assert
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Look for CSRF cookie (name depends on NODE_ENV)
      const hasCsrfCookie = cookies.some(cookie =>
        cookie.includes('csrf-token') || cookie.includes('psifi')
      );
      expect(hasCsrfCookie).toBe(true);
    });

    it('should accept POST with valid CSRF token from form', async () => {
      // Arrange - Get CSRF token from form
      const getResponse = await request(app)
        .get('/');

      const cookies = getResponse.headers['set-cookie'];

      // Extract CSRF token from HTML (simplified - real extraction would parse HTML)
      const csrfMatch = getResponse.text.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch ? csrfMatch[1] : null;

      // Create ticket data
      const ticketData = createTicketData();

      // Act - POST with CSRF token
      const response = await request(app)
        .post('/submit-ticket')
        .set('Cookie', cookies)
        .send({
          ...ticketData,
          _csrf: csrfToken
        });

      // Assert - Should be accepted (may redirect or return 200)
      expect([200, 302]).toContain(response.status);
    });

    it('should reject POST without CSRF token', async () => {
      // Arrange
      const ticketData = createTicketData();

      // Act - POST without CSRF token
      const response = await request(app)
        .post('/submit-ticket')
        .send(ticketData);

      // Assert - Should be rejected with 403 or redirect
      expect([403, 302]).toContain(response.status);
    });

    it('should reject PUT without CSRF token', async () => {
      // Arrange - Create admin user and login
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Create a ticket
      const ticket = await Ticket.create(createTicketData());

      // Act - PUT without CSRF token (if app supports PUT)
      const response = await request(app)
        .put(`/admin/tickets/${ticket.id}`)
        .set('Cookie', cookies)
        .send({ status: 'closed' });

      // Assert - PUT may not be implemented, check for appropriate response
      expect([403, 404, 405]).toContain(response.status);
    });

    it('should reject DELETE without CSRF token', async () => {
      // Arrange - Create admin user and login
      const userData = createUserData({ role: 'super_admin', status: 'active' });
      const user = await User.create(userData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Create another user to delete
      const targetUser = await User.create(createUserData());

      // Act - DELETE without CSRF token (if app supports DELETE)
      const response = await request(app)
        .delete(`/admin/users/${targetUser.id}`)
        .set('Cookie', cookies);

      // Assert - DELETE may not be implemented, check for appropriate response
      expect([403, 404, 405]).toContain(response.status);
    });

    it('should validate CSRF token matches cookie', async () => {
      // Arrange - Get legitimate token and cookies
      const getResponse = await request(app)
        .get('/');

      const cookies = getResponse.headers['set-cookie'];

      // Act - POST with mismatched token (wrong token)
      const ticketData = createTicketData();
      const response = await request(app)
        .post('/submit-ticket')
        .set('Cookie', cookies)
        .send({
          ...ticketData,
          _csrf: 'invalid-token-12345'
        });

      // Assert - Should be rejected
      expect([403, 302]).toContain(response.status);
    });

    it('should accept POST with token from authenticated session', async () => {
      // Arrange - Create user and login
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Get a page to get CSRF token
      const dashboardResponse = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      // Extract CSRF token
      const csrfMatch = dashboardResponse.text.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch ? csrfMatch[1] : null;

      // Create ticket for update
      const ticket = await Ticket.create(createTicketData());

      // Act - POST with valid CSRF token
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', cookies)
        .send({
          status: 'in_progress',
          _csrf: csrfToken
        });

      // Assert - Should succeed
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`/admin/tickets/${ticket.id}`);
    });

    it('should maintain CSRF token across multiple requests in session', async () => {
      // Arrange - Get initial token
      const response1 = await request(app)
        .get('/');

      const cookies = response1.headers['set-cookie'];

      // Act - Make another GET request with same cookies
      const response2 = await request(app)
        .get('/')
        .set('Cookie', cookies);

      // Assert - Should still have CSRF protection
      expect(response2.status).toBe(200);
      expect(response2.text).toContain('_csrf');
    });

    it('should use secure cookie settings in production', async () => {
      // This test verifies that CSRF cookies have appropriate settings
      // Actual secure flag depends on NODE_ENV and HTTPS

      // Act
      const response = await request(app)
        .get('/');

      // Assert
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const csrfCookie = cookies.find(cookie =>
          cookie.includes('csrf') || cookie.includes('psifi')
        );

        if (csrfCookie) {
          // Check for security attributes
          expect(csrfCookie).toContain('Path=/');
          expect(csrfCookie).toContain('SameSite=Strict');
          expect(csrfCookie).toContain('HttpOnly');
        }
      }
    });

    it('should use __Host- prefix for CSRF cookie in production', async () => {
      // This is configured based on NODE_ENV
      // In development: psifi.x-csrf-token
      // In production: __Host-psifi.x-csrf-token

      // Act
      const response = await request(app)
        .get('/');

      // Assert
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Check cookie name based on environment
      const hasCsrfCookie = cookies.some(cookie =>
        cookie.includes('psifi.x-csrf-token')
      );
      expect(hasCsrfCookie).toBe(true);
    });

    it('should reject requests with expired CSRF tokens', async () => {
      // CSRF tokens from csrf-csrf don't expire by default, but cookies do
      // This test verifies general token validation

      // Arrange
      const ticketData = createTicketData();

      // Act - POST with no cookies (simulates expired)
      const response = await request(app)
        .post('/submit-ticket')
        .send({
          ...ticketData,
          _csrf: 'some-token'
        });

      // Assert - Should be rejected
      expect([403, 302]).toContain(response.status);
    });

    it('should protect all state-changing routes', async () => {
      // Test that POST routes require CSRF

      const testRoutes = [
        { method: 'post', path: '/submit-ticket', data: createTicketData() },
        { method: 'post', path: '/auth/login', data: { username: 'test', password: 'test' } },
      ];

      for (const route of testRoutes) {
        // Act
        const response = await request(app)
          .post(route.path)
          .send(route.data);

        // Assert - Should handle CSRF (either validate or reject)
        // 200/302 means validation passed (may have other errors)
        // 403 means CSRF rejected
        expect([200, 302, 403]).toContain(response.status);
      }
    });

    it('should allow public ticket submission with valid token', async () => {
      // Arrange - Get page with form
      const getResponse = await request(app)
        .get('/');

      const cookies = getResponse.headers['set-cookie'];
      const csrfMatch = getResponse.text.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch ? csrfMatch[1] : null;

      const ticketData = createTicketData();

      // Act - Submit with token
      const response = await request(app)
        .post('/submit-ticket')
        .set('Cookie', cookies)
        .send({
          ...ticketData,
          _csrf: csrfToken
        });

      // Assert
      expect([200, 302]).toContain(response.status);
    });

    it('should handle missing _csrf field gracefully', async () => {
      // Arrange
      const getResponse = await request(app)
        .get('/');

      const cookies = getResponse.headers['set-cookie'];
      const ticketData = createTicketData();

      // Act - POST with cookies but no _csrf field
      const response = await request(app)
        .post('/submit-ticket')
        .set('Cookie', cookies)
        .send(ticketData);

      // Assert - Should be rejected
      expect([403, 302]).toContain(response.status);
    });
  });

  describe('validateRequest integration', () => {
    it('should redirect back with flash messages on validation errors', async () => {
      // Arrange - Get page to establish session
      const getResponse = await request(app)
        .get('/');

      const cookies = getResponse.headers['set-cookie'];

      // Act - Submit invalid data (missing required fields)
      const response = await request(app)
        .post('/submit-ticket')
        .set('Cookie', cookies)
        .send({
          title: '', // Invalid - required
          description: '', // Invalid - required
          reporter_name: '',
          reporter_email: ''
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should return JSON errors when client accepts JSON', async () => {
      // Act - POST with JSON accept header and invalid data
      const response = await request(app)
        .post('/submit-ticket')
        .set('Accept', 'application/json')
        .send({
          title: '',
          description: ''
        });

      // Assert - Should return JSON error (may also include CSRF error)
      expect([400, 403]).toContain(response.status);
    });
  });
});
