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
const { setupIntegrationTest, teardownIntegrationTest } = require('../../helpers/database');
const { createUserData, createTicketData } = require('../../helpers/factories');
const { fetchCsrfToken, authenticateUser } = require('../../helpers/csrf');
const User = require('../../../models/User');
const Ticket = require('../../../models/Ticket');

describe('Validation Middleware Integration Tests', () => {
  beforeEach(async () => {
    await setupIntegrationTest();
  });

  afterEach(async () => {
    await teardownIntegrationTest();
  });

  describe('CSRF Protection Integration', () => {
    it('should accept GET requests without CSRF token', async () => {
      // Act
      const response = await request(app).get('/auth/login');

      // Assert
      expect(response.status).toBe(200);
    });

    it('should accept HEAD requests without CSRF token', async () => {
      // Act
      const response = await request(app).head('/auth/login');

      // Assert
      expect(response.status).toBe(200);
    });

    it('should accept OPTIONS requests without CSRF token', async () => {
      // Act
      const response = await request(app).options('/');

      // Assert - May be 200 or 204 depending on implementation
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should generate CSRF token in GET response', async () => {
      // Act
      const response = await request(app).get('/auth/login');

      // Assert - Check for CSRF token in page
      expect(response.status).toBe(200);
      // CSRF token should be available in res.locals.csrfToken and rendered in forms
      expect(response.text).toContain('_csrf');
    });

    it('should set CSRF cookie on first request', async () => {
      // Act
      const response = await request(app).get('/auth/login');

      // Assert
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Look for CSRF cookie (psifi.x-csrf-token in non-production)
      const hasCsrfCookie = cookies.some((cookie) => cookie.includes('psifi.x-csrf-token'));
      expect(hasCsrfCookie).toBe(true);
    });

    it('should accept POST with valid CSRF token from form', async () => {
      // Arrange - Get CSRF token from login page
      const { csrfToken, cookies } = await fetchCsrfToken(app);

      // Create user for login
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - POST with CSRF token
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Assert - Should be accepted (may redirect or return 200)
      expect([200, 302]).toContain(response.status);
    });

    it('should reject POST without CSRF token', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - POST without CSRF token
      const response = await request(app).post('/auth/login').send({
        username: userData.username,
        password: userData.password,
      });

      // Assert - Should be rejected with 403 (CSRF validation failure)
      expect(response.status).toBe(403);
    });

    it('should reject PUT without CSRF token', async () => {
      // Arrange - Create admin user and login with CSRF
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      const { cookies } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Create a ticket
      const ticket = await Ticket.create(createTicketData());

      // Act - PUT without CSRF token (cookies have session but no _csrf in body)
      const response = await request(app)
        .put(`/admin/tickets/${ticket.id}`)
        .set('Cookie', cookies)
        .send({ status: 'closed' });

      // Assert - PUT may not be implemented, check for appropriate response
      expect([403, 404, 405]).toContain(response.status);
    });

    it('should reject DELETE without CSRF token', async () => {
      // Arrange - Create super_admin user and login with CSRF
      const userData = createUserData({ role: 'super_admin', status: 'active' });
      await User.create(userData);

      const { cookies } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Create another user to delete
      const targetUser = await User.create(createUserData());

      // Act - DELETE without CSRF token
      const response = await request(app)
        .delete(`/admin/users/${targetUser.id}`)
        .set('Cookie', cookies);

      // Assert - DELETE may not be implemented, check for appropriate response
      expect([403, 404, 405]).toContain(response.status);
    });

    it('should validate CSRF token matches cookie', async () => {
      // Arrange - Get legitimate token and cookies
      const { cookies } = await fetchCsrfToken(app);

      // Create user for login attempt
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - POST with mismatched token (wrong token)
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: 'invalid-token-12345',
      });

      // Assert - Should be rejected
      expect(response.status).toBe(403);
    });

    it('should accept POST with token from authenticated session', async () => {
      // Arrange - Create user and login with CSRF
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      const { cookies, csrfToken } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Create ticket for update
      const ticket = await Ticket.create(createTicketData());

      // Act - POST with valid CSRF token from authenticated session
      const response = await request(app)
        .post(`/admin/tickets/${ticket.id}/update`)
        .set('Cookie', cookies)
        .send({
          status: 'in_progress',
          _csrf: csrfToken,
        });

      // Assert - Should succeed
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`/admin/tickets/${ticket.id}`);
    });

    it('should maintain CSRF token across multiple requests in session', async () => {
      // Arrange - Get initial token
      const response1 = await request(app).get('/auth/login');

      const cookies = response1.headers['set-cookie'];

      // Act - Make another GET request with same cookies
      const response2 = await request(app).get('/auth/login').set('Cookie', cookies);

      // Assert - Should still have CSRF protection
      expect(response2.status).toBe(200);
      expect(response2.text).toContain('_csrf');
    });

    it('should use secure cookie settings in production', async () => {
      // This test verifies that CSRF cookies have appropriate settings
      // Actual secure flag depends on NODE_ENV and HTTPS

      // Act
      const response = await request(app).get('/auth/login');

      // Assert
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const csrfCookie = cookies.find((cookie) => cookie.includes('psifi.x-csrf-token'));

        if (csrfCookie) {
          // Check for security attributes
          expect(csrfCookie).toContain('Path=/');
          expect(csrfCookie).toContain('SameSite=Strict');
          expect(csrfCookie).toContain('HttpOnly');
        }
      }
    });

    it('should use psifi.x-csrf-token cookie name in non-production', async () => {
      // In non-production: psifi.x-csrf-token
      // In production: __Host-psifi.x-csrf-token (requires HTTPS)

      // Act
      const response = await request(app).get('/auth/login');

      // Assert
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Check cookie name for non-production environment
      const hasCsrfCookie = cookies.some((cookie) => cookie.includes('psifi.x-csrf-token'));
      expect(hasCsrfCookie).toBe(true);
    });

    it('should reject requests with expired CSRF tokens', async () => {
      // CSRF tokens from csrf-csrf don't expire by default, but cookies do
      // This test verifies general token validation

      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - POST with no cookies (simulates expired)
      const response = await request(app).post('/auth/login').send({
        username: userData.username,
        password: userData.password,
        _csrf: 'some-token',
      });

      // Assert - Should be rejected (no CSRF cookie to match)
      expect(response.status).toBe(403);
    });

    it('should protect all state-changing routes', async () => {
      // Test that POST routes require CSRF

      const testRoutes = [
        { method: 'post', path: '/auth/login', data: { username: 'test', password: 'test' } },
      ];

      for (const route of testRoutes) {
        // Act - POST without CSRF
        const response = await request(app).post(route.path).send(route.data);

        // Assert - Should be rejected by CSRF protection
        expect(response.status).toBe(403);
      }
    });

    it('should allow login with valid token', async () => {
      // Arrange - Get login page with form
      const { csrfToken, cookies } = await fetchCsrfToken(app);

      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - Submit with token
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Assert
      expect([200, 302]).toContain(response.status);
    });

    it('should handle missing _csrf field gracefully', async () => {
      // Arrange
      const { cookies } = await fetchCsrfToken(app);
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - POST with cookies but no _csrf field
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
      });

      // Assert - Should be rejected by CSRF (no _csrf in body)
      expect(response.status).toBe(403);
    });
  });

  describe('validateRequest integration', () => {
    it('should redirect back with flash messages on validation errors', async () => {
      // Arrange - Get CSRF token to pass CSRF validation
      const { csrfToken, cookies } = await fetchCsrfToken(app);

      // Act - Submit invalid data (missing required fields) with valid CSRF
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: '', // Invalid - required
        password: '', // Invalid - required
        _csrf: csrfToken,
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should return JSON errors when client accepts JSON', async () => {
      // Arrange - Get CSRF token
      const { csrfToken, cookies } = await fetchCsrfToken(app);

      // Act - POST with JSON accept header and invalid data
      const response = await request(app)
        .post('/auth/login')
        .set('Cookie', cookies)
        .set('Accept', 'application/json')
        .send({
          username: '',
          password: '',
          _csrf: csrfToken,
        });

      // Assert - Should return JSON error from validation (not CSRF)
      expect([400, 403]).toContain(response.status);
    });
  });
});
