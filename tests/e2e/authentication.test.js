/**
 * Authentication End-to-End Tests
 *
 * Tests complete authentication workflows from start to finish:
 * - Account locking workflow (5 failed attempts -> locked -> unlock -> success)
 * - Session management workflow (login -> persist -> logout -> invalidate)
 * - Multi-user authentication scenarios
 * - Password reset and security features
 *
 * These tests validate the entire authentication stack working together.
 */

const request = require('supertest');
const app = require('../../app');
const { setupIntegrationTest, teardownIntegrationTest } = require('../helpers/database');
const { createUserData } = require('../helpers/factories');
const { fetchCsrfToken, authenticateUser } = require('../helpers/csrf');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');

describe('Authentication E2E Tests', () => {
  beforeEach(async () => {
    await setupIntegrationTest();
  });

  afterEach(async () => {
    await teardownIntegrationTest();
  });

  describe('Account Locking Workflow', () => {
    it('should complete full account locking and unlock workflow', async () => {
      // Step 1: Create user
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Step 2: Attempt login with wrong password 5 times
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      for (let i = 1; i <= 5; i++) {
        const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
          username: userData.username,
          password: 'WrongPassword123!',
          _csrf: csrfToken,
        });

        // Should redirect back to login
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/auth/login');

        // Verify login_attempts increments
        const userCheck = await User.findByUsernameWithPassword(userData.username);
        expect(userCheck.login_attempts).toBe(i);
      }

      // Step 3: Verify account is locked after 5 attempts
      const lockedUser = await User.findByUsernameWithPassword(userData.username);
      expect(lockedUser.login_attempts).toBe(5);

      // Step 4: Attempt login with CORRECT password (should fail - account locked)
      const { csrfToken: csrfToken2, cookies: cookies2 } = await fetchCsrfToken(app);
      const lockedLoginResponse = await request(app)
        .post('/auth/login')
        .set('Cookie', cookies2)
        .send({
          username: userData.username,
          password: userData.password,
          _csrf: csrfToken2,
        });

      expect(lockedLoginResponse.status).toBe(302);
      expect(lockedLoginResponse.headers.location).toBe('/auth/login');

      // Step 5: Super admin unlocks account (reset login_attempts)
      await User.update(user.id, { login_attempts: 0 });

      // Step 6: Verify successful login works after unlock
      const { csrfToken: csrfToken3, cookies: cookies3 } = await fetchCsrfToken(app);
      const successResponse = await request(app).post('/auth/login').set('Cookie', cookies3).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken3,
      });

      expect(successResponse.status).toBe(302);
      expect(successResponse.headers.location).toBe('/admin/dashboard');

      // Step 7: Verify login_attempts was reset to 0
      const unlockedUser = await User.findByUsernameWithPassword(userData.username);
      expect(unlockedUser.login_attempts).toBe(0);
      expect(unlockedUser.last_login_at).not.toBeNull();

      // Step 8: Verify audit log contains login event
      const auditLogs = await AuditLog.findByActor(user.id);
      const loginLog = auditLogs.find((log) => log.action === 'USER_LOGIN');
      expect(loginLog).toBeDefined();
      expect(loginLog.details.success).toBe(true);
    });

    it('should increment login_attempts on each failed attempt', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const _user = await User.create(userData);

      // Act & Assert - Test incremental locking
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      for (let attempt = 1; attempt <= 5; attempt++) {
        await request(app).post('/auth/login').set('Cookie', cookies).send({
          username: userData.username,
          password: 'WrongPassword!',
          _csrf: csrfToken,
        });

        const userCheck = await User.findByUsernameWithPassword(userData.username);
        expect(userCheck.login_attempts).toBe(attempt);
      }
    });

    it('should prevent login even with correct password when locked', async () => {
      // Arrange - Create locked account
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Lock account
      await User.update(user.id, { login_attempts: 5 });

      // Act - Try to login with correct password
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Assert - Should be rejected (redirect to login, not dashboard)
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');

      // Verify the session does not grant access to protected routes
      const responseCookies = response.headers['set-cookie'];
      if (responseCookies) {
        const dashboardResponse = await request(app)
          .get('/admin/dashboard')
          .set('Cookie', responseCookies);
        expect(dashboardResponse.status).toBe(302);
        expect(dashboardResponse.headers.location).toBe('/auth/login');
      }
    });

    it('should reset login_attempts to 0 on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      // Simulate some failed attempts
      await User.update(user.id, { login_attempts: 3 });

      // Act - Successful login
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Assert
      const userAfter = await User.findByUsernameWithPassword(userData.username);
      expect(userAfter.login_attempts).toBe(0);
    });
  });

  describe('Session Management Workflow', () => {
    it('should complete full session lifecycle', async () => {
      // Step 1: Create user
      const userData = createUserData({ role: 'admin', status: 'active' });
      const _user = await User.create(userData);

      // Step 2: Login - Session created
      const { cookies, csrfToken } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      expect(cookies).toBeDefined();

      // Step 3: Session persists across requests
      const dashboardResponse1 = await request(app).get('/admin/dashboard').set('Cookie', cookies);

      expect(dashboardResponse1.status).toBe(200);

      const dashboardResponse2 = await request(app).get('/admin/dashboard').set('Cookie', cookies);

      expect(dashboardResponse2.status).toBe(200);

      // Step 4: Logout - Session destroyed
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies)
        .send({ _csrf: csrfToken });

      expect(logoutResponse.status).toBe(302);
      expect(logoutResponse.headers.location).toBe('/auth/login');

      // Step 5: Access protected route without session - Redirects to login
      const afterLogoutResponse = await request(app).get('/admin/dashboard').set('Cookie', cookies);

      expect(afterLogoutResponse.status).toBe(302);
      expect(afterLogoutResponse.headers.location).toBe('/auth/login');
    });

    it('should maintain session across multiple page views', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      const { cookies } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Act - Access multiple protected routes
      const routes = [
        '/admin/dashboard',
        '/admin/dashboard?status=open',
        '/admin/dashboard?priority=high',
      ];

      for (const route of routes) {
        const response = await request(app).get(route).set('Cookie', cookies);

        // Assert - All should succeed
        expect(response.status).toBe(200);
      }
    });

    it('should invalidate session after logout', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      const { cookies, csrfToken } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Act - Logout
      await request(app).post('/auth/logout').set('Cookie', cookies).send({ _csrf: csrfToken });

      // Assert - Try to use old session
      const response = await request(app).get('/admin/dashboard').set('Cookie', cookies);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should redirect authenticated users away from login page', async () => {
      // Arrange - Login
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      const { cookies } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Act - Try to access login page while authenticated
      const response = await request(app).get('/auth/login').set('Cookie', cookies);

      // Assert - Should redirect to dashboard
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });
  });

  describe('Multi-User Authentication Scenarios', () => {
    it('should handle concurrent sessions for different users', async () => {
      // Step 1: Create two users
      const user1Data = createUserData({ role: 'admin', status: 'active' });
      const user2Data = createUserData({ role: 'super_admin', status: 'active' });

      const _user1 = await User.create(user1Data);
      const _user2 = await User.create(user2Data);

      // Step 2: Login both users
      const { cookies: cookies1 } = await authenticateUser(app, {
        username: user1Data.username,
        password: user1Data.password,
      });

      const { cookies: cookies2 } = await authenticateUser(app, {
        username: user2Data.username,
        password: user2Data.password,
      });

      // Step 3: Both should access their respective routes
      const user1Dashboard = await request(app).get('/admin/dashboard').set('Cookie', cookies1);

      expect(user1Dashboard.status).toBe(200);

      const user2Dashboard = await request(app).get('/admin/dashboard').set('Cookie', cookies2);

      expect(user2Dashboard.status).toBe(200);

      // Step 4: User2 (super_admin) can access user management
      const user2Management = await request(app).get('/admin/users').set('Cookie', cookies2);

      expect(user2Management.status).toBe(200);

      // Step 5: User1 (regular admin) cannot access user management
      const user1Management = await request(app).get('/admin/users').set('Cookie', cookies1);

      expect(user1Management.status).toBe(302);
      expect(user1Management.headers.location).toBe('/admin/dashboard');
    });

    it('should isolate sessions between different users', async () => {
      // Arrange
      const user1Data = createUserData({ role: 'admin', status: 'active' });
      const user2Data = createUserData({ role: 'admin', status: 'active' });

      await User.create(user1Data);
      await User.create(user2Data);

      // Act - Login both
      const { cookies: cookies1 } = await authenticateUser(app, {
        username: user1Data.username,
        password: user1Data.password,
      });

      const { cookies: cookies2 } = await authenticateUser(app, {
        username: user2Data.username,
        password: user2Data.password,
      });

      // Assert - Sessions should be different
      expect(cookies1).not.toEqual(cookies2);

      // Both should work independently
      const dash1 = await request(app).get('/admin/dashboard').set('Cookie', cookies1);

      const dash2 = await request(app).get('/admin/dashboard').set('Cookie', cookies2);

      expect(dash1.status).toBe(200);
      expect(dash2.status).toBe(200);
    });
  });

  describe('Security Features', () => {
    it('should reject login for inactive users throughout workflow', async () => {
      // Step 1: Create inactive user
      const userData = createUserData({ role: 'admin', status: 'inactive' });
      await User.create(userData);

      // Step 2: Attempt login
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Step 3: Verify rejection (redirect to login, not dashboard)
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');

      // Verify the session does not grant access to protected routes
      const responseCookies = response.headers['set-cookie'];
      if (responseCookies) {
        const dashboardResponse = await request(app)
          .get('/admin/dashboard')
          .set('Cookie', responseCookies);
        expect(dashboardResponse.status).toBe(302);
        expect(dashboardResponse.headers.location).toBe('/auth/login');
      }
    });

    it('should reject login for deleted users', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'deleted' });
      await User.create(userData);

      // Act
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      const response = await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should invalidate session when user is deactivated', async () => {
      // Step 1: Login
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      const { cookies } = await authenticateUser(app, {
        username: userData.username,
        password: userData.password,
      });

      // Step 2: Verify access works
      const beforeDeactivate = await request(app).get('/admin/dashboard').set('Cookie', cookies);

      expect(beforeDeactivate.status).toBe(200);

      // Step 3: Deactivate user
      await User.update(user.id, { status: 'inactive' });

      // Step 4: Try to access - should be redirected
      const afterDeactivate = await request(app).get('/admin/dashboard').set('Cookie', cookies);

      expect(afterDeactivate.status).toBe(302);
      expect(afterDeactivate.headers.location).toBe('/auth/login');
    });

    it('should update last_login_at timestamp on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData);

      const userBefore = await User.findById(user.id);
      expect(userBefore.last_login_at).toBeNull();

      // Act
      const { csrfToken, cookies } = await fetchCsrfToken(app);
      await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: userData.password,
        _csrf: csrfToken,
      });

      // Assert
      const userAfter = await User.findById(user.id);
      expect(userAfter.last_login_at).not.toBeNull();
      expect(new Date(userAfter.last_login_at)).toBeInstanceOf(Date);
    });

    it('should prevent timing attacks during authentication', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData);

      // Use SAME CSRF token for both POSTs to not skew timing
      const { csrfToken, cookies } = await fetchCsrfToken(app);

      // Act - Test timing for existing user
      const start1 = Date.now();
      await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: userData.username,
        password: 'WrongPassword123!',
        _csrf: csrfToken,
      });
      const duration1 = Date.now() - start1;

      // Act - Test timing for non-existent user
      const start2 = Date.now();
      await request(app).post('/auth/login').set('Cookie', cookies).send({
        username: 'nonexistentuser12345',
        password: 'WrongPassword123!',
        _csrf: csrfToken,
      });
      const duration2 = Date.now() - start2;

      // Assert - Timing should be similar (within 200ms)
      const timeDiff = Math.abs(duration1 - duration2);
      expect(timeDiff).toBeLessThan(200);
    });
  });
});
