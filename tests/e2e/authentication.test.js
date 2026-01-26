/**
 * Authentication End-to-End Tests
 *
 * Tests complete authentication workflows from start to finish:
 * - Account locking workflow (5 failed attempts → locked → unlock → success)
 * - Session management workflow (login → persist → logout → invalidate)
 * - Multi-user authentication scenarios
 * - Password reset and security features
 *
 * These tests validate the entire authentication stack working together.
 */

const request = require('supertest');
const app = require('../../app');
const { setupTestDatabase, teardownTestDatabase, getTestClient } = require('../helpers/database');
const { createUserData } = require('../helpers/factories');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');

describe('Authentication E2E Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('Account Locking Workflow', () => {
    it('should complete full account locking and unlock workflow', async () => {
      // Step 1: Create user
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData, getTestClient());

      // Step 2: Attempt login with wrong password 5 times
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/auth/login')
          .send({
            username: userData.username,
            password: 'WrongPassword123!'
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
      const lockedLoginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      expect(lockedLoginResponse.status).toBe(302);
      expect(lockedLoginResponse.headers.location).toBe('/auth/login');

      // Step 5: Super admin unlocks account (reset login_attempts)
      await User.update(user.id, { login_attempts: 0 }, getTestClient());

      // Step 6: Verify successful login works after unlock
      const successResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      expect(successResponse.status).toBe(302);
      expect(successResponse.headers.location).toBe('/admin/dashboard');

      // Step 7: Verify login_attempts was reset to 0
      const unlockedUser = await User.findByUsernameWithPassword(userData.username);
      expect(unlockedUser.login_attempts).toBe(0);
      expect(unlockedUser.last_login_at).not.toBeNull();

      // Step 8: Verify audit log contains login event
      const auditLogs = await AuditLog.findByActor(user.id);
      const loginLog = auditLogs.find(log => log.action === 'USER_LOGIN');
      expect(loginLog).toBeDefined();
      expect(loginLog.details.success).toBe(true);
    });

    it('should increment login_attempts on each failed attempt', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData, getTestClient());

      // Act & Assert - Test incremental locking
      for (let attempt = 1; attempt <= 5; attempt++) {
        await request(app)
          .post('/auth/login')
          .send({
            username: userData.username,
            password: 'WrongPassword!'
          });

        const userCheck = await User.findByUsernameWithPassword(userData.username);
        expect(userCheck.login_attempts).toBe(attempt);
      }
    });

    it('should prevent login even with correct password when locked', async () => {
      // Arrange - Create locked account
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData, getTestClient());

      // Lock account
      await User.update(user.id, { login_attempts: 5 }, getTestClient());

      // Act - Try to login with correct password
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert - Should be rejected
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('should reset login_attempts to 0 on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData, getTestClient());

      // Simulate some failed attempts
      await User.update(user.id, { login_attempts: 3 }, getTestClient());

      // Act - Successful login
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
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
      const user = await User.create(userData, getTestClient());

      // Step 2: Login - Session created
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      expect(loginResponse.status).toBe(302);
      const cookies = loginResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Step 3: Session persists across requests
      const dashboardResponse1 = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      expect(dashboardResponse1.status).toBe(200);

      const dashboardResponse2 = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      expect(dashboardResponse2.status).toBe(200);

      // Step 4: Logout - Session destroyed
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      expect(logoutResponse.status).toBe(302);
      expect(logoutResponse.headers.location).toBe('/auth/login');

      // Step 5: Access protected route without session - Redirects to login
      const afterLogoutResponse = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      expect(afterLogoutResponse.status).toBe(302);
      expect(afterLogoutResponse.headers.location).toBe('/auth/login');
    });

    it('should maintain session across multiple page views', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Act - Access multiple protected routes
      const routes = [
        '/admin/dashboard',
        '/admin/dashboard?status=open',
        '/admin/dashboard?priority=high'
      ];

      for (const route of routes) {
        const response = await request(app)
          .get(route)
          .set('Cookie', cookies);

        // Assert - All should succeed
        expect(response.status).toBe(200);
      }
    });

    it('should invalidate session after logout', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Act - Logout
      await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      // Assert - Try to use old session
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should redirect authenticated users away from login page', async () => {
      // Arrange - Login
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Act - Try to access login page while authenticated
      const response = await request(app)
        .get('/auth/login')
        .set('Cookie', cookies);

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

      const user1 = await User.create(user1Data, getTestClient());
      const user2 = await User.create(user2Data, getTestClient());

      // Step 2: Login both users
      const login1 = await request(app)
        .post('/auth/login')
        .send({
          username: user1Data.username,
          password: user1Data.password
        });

      const cookies1 = login1.headers['set-cookie'];

      const login2 = await request(app)
        .post('/auth/login')
        .send({
          username: user2Data.username,
          password: user2Data.password
        });

      const cookies2 = login2.headers['set-cookie'];

      // Step 3: Both should access their respective routes
      const user1Dashboard = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies1);

      expect(user1Dashboard.status).toBe(200);

      const user2Dashboard = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies2);

      expect(user2Dashboard.status).toBe(200);

      // Step 4: User2 (super_admin) can access user management
      const user2Management = await request(app)
        .get('/admin/users')
        .set('Cookie', cookies2);

      expect(user2Management.status).toBe(200);

      // Step 5: User1 (regular admin) cannot access user management
      const user1Management = await request(app)
        .get('/admin/users')
        .set('Cookie', cookies1);

      expect(user1Management.status).toBe(302);
      expect(user1Management.headers.location).toBe('/admin/dashboard');
    });

    it('should isolate sessions between different users', async () => {
      // Arrange
      const user1Data = createUserData({ role: 'admin', status: 'active' });
      const user2Data = createUserData({ role: 'admin', status: 'active' });

      await User.create(user1Data, getTestClient());
      await User.create(user2Data, getTestClient());

      // Act - Login both
      const login1 = await request(app)
        .post('/auth/login')
        .send({
          username: user1Data.username,
          password: user1Data.password
        });

      const login2 = await request(app)
        .post('/auth/login')
        .send({
          username: user2Data.username,
          password: user2Data.password
        });

      const cookies1 = login1.headers['set-cookie'];
      const cookies2 = login2.headers['set-cookie'];

      // Assert - Sessions should be different
      expect(cookies1).not.toEqual(cookies2);

      // Both should work independently
      const dash1 = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies1);

      const dash2 = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies2);

      expect(dash1.status).toBe(200);
      expect(dash2.status).toBe(200);
    });
  });

  describe('Security Features', () => {
    it('should reject login for inactive users throughout workflow', async () => {
      // Step 1: Create inactive user
      const userData = createUserData({ role: 'admin', status: 'inactive' });
      await User.create(userData, getTestClient());

      // Step 2: Attempt login
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Step 3: Verify rejection
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('should reject login for deleted users', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'deleted' });
      await User.create(userData, getTestClient());

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

    it('should invalidate session when user is deactivated', async () => {
      // Step 1: Login
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Step 2: Verify access works
      const beforeDeactivate = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      expect(beforeDeactivate.status).toBe(200);

      // Step 3: Deactivate user
      await User.update(user.id, { status: 'inactive' }, getTestClient());

      // Step 4: Try to access - should be redirected
      const afterDeactivate = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', cookies);

      expect(afterDeactivate.status).toBe(302);
      expect(afterDeactivate.headers.location).toBe('/auth/login');
    });

    it('should update last_login_at timestamp on successful login', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      const user = await User.create(userData, getTestClient());

      const userBefore = await User.findById(user.id);
      expect(userBefore.last_login_at).toBeNull();

      // Act
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });

      // Assert
      const userAfter = await User.findById(user.id);
      expect(userAfter.last_login_at).not.toBeNull();
      expect(new Date(userAfter.last_login_at)).toBeInstanceOf(Date);
    });

    it('should prevent timing attacks during authentication', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', status: 'active' });
      await User.create(userData, getTestClient());

      // Act - Test timing for existing user
      const start1 = Date.now();
      await request(app)
        .post('/auth/login')
        .send({
          username: userData.username,
          password: 'WrongPassword123!'
        });
      const duration1 = Date.now() - start1;

      // Act - Test timing for non-existent user
      const start2 = Date.now();
      await request(app)
        .post('/auth/login')
        .send({
          username: 'nonexistentuser12345',
          password: 'WrongPassword123!'
        });
      const duration2 = Date.now() - start2;

      // Assert - Timing should be similar (within 200ms)
      const timeDiff = Math.abs(duration1 - duration2);
      expect(timeDiff).toBeLessThan(200);
    });
  });
});
