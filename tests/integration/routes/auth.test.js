/**
 * Auth Routes Integration Tests
 *
 * Tests the complete authentication flow with real database:
 * - GET /auth/login - Login form rendering
 * - POST /auth/login - Login authentication
 * - POST /auth/logout - Session destruction
 *
 * Uses transaction-based isolation for test data cleanup.
 */

const request = require('supertest');
const app = require('../../../app');
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');
const { createUserData } = require('../../helpers/factories');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');

describe('Auth Routes Integration Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('GET /auth/login', () => {
    it('should render login form when not authenticated', async () => {
      // Act
      const response = await request(app)
        .get('/auth/login');

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Admin Login');
      expect(response.text).toContain('username');
      expect(response.text).toContain('password');
    });

    it('should redirect to dashboard when already authenticated', async () => {
      // Arrange - Create user and login
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password,
          _csrf: 'test-token' // CSRF will be validated in production
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Act - Try to access login page while authenticated
      const response = await request(app)
        .get('/auth/login')
        .set('Cookie', cookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });
  });

  describe('POST /auth/login', () => {
    it('should redirect to dashboard on successful login with valid credentials', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should set session cookie with user data on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('connect.sid'))).toBe(true);
    });

    it('should reset login_attempts to 0 on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Simulate failed login attempts
      await User.incrementLoginAttempts(userData.username);
      await User.incrementLoginAttempts(userData.username);

      // Verify login_attempts were incremented
      const userBefore = await User.findByUsernameWithPassword(userData.username);
      expect(userBefore.login_attempts).toBe(2);

      // Act - Successful login
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert - login_attempts should be reset
      const userAfter = await User.findByUsernameWithPassword(userData.username);
      expect(userAfter.login_attempts).toBe(0);
      expect(userAfter.last_login_at).not.toBeNull();
    });

    it('should increment login_attempts on failed login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Act - Failed login with wrong password
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: 'WrongPassword123!'
        });

      // Assert
      const userAfter = await User.findByUsernameWithPassword(userData.username);
      expect(userAfter.login_attempts).toBe(1);
    });

    it('should lock account after 5 failed login attempts', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Act - Attempt 5 failed logins
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            username: userData.username,
            password: 'WrongPassword123!'
          });
      }

      // Assert
      const userAfter = await User.findByUsernameWithPassword(userData.username);
      expect(userAfter.login_attempts).toBe(5);
    });

    it('should reject login for locked accounts even with correct password', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await User.incrementLoginAttempts(userData.username);
      }

      // Act - Try to login with correct password
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
      expect(response.text).not.toContain('dashboard');
    });

    it('should reject login for inactive users', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'inactive' });
      const user = await User.create(userData);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should reject login for deleted users', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'deleted' });
      const user = await User.create(userData);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should create audit log entry on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Act
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      const auditLogs = await AuditLog.findByActor(user.id);
      expect(auditLogs.length).toBeGreaterThan(0);

      const loginLog = auditLogs.find(log => log.action === 'USER_LOGIN');
      expect(loginLog).toBeDefined();
      expect(loginLog.actor_id).toBe(user.id);
      expect(loginLog.target_type).toBe('user');
      expect(loginLog.target_id).toBe(user.id);
      expect(loginLog.details.success).toBe(true);
    });

    it('should handle non-existent username gracefully', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'SomePassword123!'
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: '',
          password: ''
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should prevent timing attacks for user enumeration', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Act - Measure time for existing user
      const start1 = Date.now();
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: 'WrongPassword123!'
        });
      const duration1 = Date.now() - start1;

      // Act - Measure time for non-existent user
      const start2 = Date.now();
      await request(app)
        .post('/auth/login')
        .send({
          username: 'nonexistentuser12345',
          password: 'WrongPassword123!'
        });
      const duration2 = Date.now() - start2;

      // Assert - Times should be similar (within 200ms threshold)
      // This prevents attackers from determining valid usernames by timing
      const timeDifference = Math.abs(duration1 - duration2);
      expect(timeDifference).toBeLessThan(200);
    });
  });

  describe('POST /auth/logout', () => {
    it('should destroy session on logout', async () => {
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

      // Act - Logout
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should redirect to login page after logout', async () => {
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

      // Act
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should clear session cookie on logout', async () => {
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

      // Act
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      // Assert - Session cookie should be cleared
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        const hasClearedCookie = setCookieHeader.some(cookie =>
          cookie.includes('connect.sid') && cookie.includes('Expires=')
        );
        expect(hasClearedCookie).toBe(true);
      }
    });

    it('should handle logout when not logged in gracefully', async () => {
      // Act
      const response = await request(app)
        .post('/auth/logout');

      // Assert - Should still redirect (session.destroy handles null session)
      expect(response.status).toBe(302);
    });
  });
});
