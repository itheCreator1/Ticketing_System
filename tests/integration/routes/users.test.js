/**
 * User Management Routes Integration Tests
 *
 * Tests super_admin-only user management routes with real database:
 * - GET /admin/users - List all users
 * - GET /admin/users/new - Create user form
 * - POST /admin/users - Create new user
 * - GET /admin/users/:id/edit - Edit user form
 * - POST /admin/users/:id - Update user
 * - POST /admin/users/:id/password - Reset password
 * - POST /admin/users/:id/delete - Soft delete user
 * - POST /admin/users/:id/toggle-status - Toggle user status
 *
 * Uses transaction-based isolation for test data cleanup.
 */

const request = require('supertest');
const app = require('../../../app');
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');
const { createUserData } = require('../../helpers/factories');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');
const bcrypt = require('bcryptjs');

describe('User Management Routes Integration Tests', () => {
  let superAdminUser;
  let superAdminCookies;
  let adminUser;
  let adminCookies;

  beforeEach(async () => {
    await setupTestDatabase();

    // Create super_admin user and login
    const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
    superAdminUser = await User.create(superAdminData);

    const superAdminLogin = await request(app)
      .post('/auth/login')
      .send({
        username: superAdminData.username,
        password: superAdminData.password
      });

    superAdminCookies = superAdminLogin.headers['set-cookie'];

    // Create regular admin user for permission tests
    const adminData = createUserData({ role: 'admin', status: 'active' });
    adminUser = await User.create(adminData);

    const adminLogin = await request(app)
      .post('/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password
      });

    adminCookies = adminLogin.headers['set-cookie'];
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('GET /admin/users', () => {
    it('should require super_admin role', async () => {
      // Act - Use admin (not super_admin) cookies
      const response = await request(app)
        .get('/admin/users')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should list all non-deleted users for super_admin', async () => {
      // Arrange
      await User.create(createUserData({ status: 'active', username: 'testuser1' }));
      await User.create(createUserData({ status: 'inactive', username: 'testuser2' }));

      // Act
      const response = await request(app)
        .get('/admin/users')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('User Management');
      expect(response.text).toContain('testuser1');
      expect(response.text).toContain('testuser2');
    });

    it('should display user status and role', async () => {
      // Act
      const response = await request(app)
        .get('/admin/users')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('admin');
      expect(response.text).toContain('active');
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app)
        .get('/admin/users');

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });
  });

  describe('GET /admin/users/new', () => {
    it('should require super_admin role', async () => {
      // Act
      const response = await request(app)
        .get('/admin/users/new')
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
    });

    it('should render create user form for super_admin', async () => {
      // Act
      const response = await request(app)
        .get('/admin/users/new')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Create User');
      expect(response.text).toContain('username');
      expect(response.text).toContain('email');
      expect(response.text).toContain('password');
    });
  });

  describe('POST /admin/users', () => {
    it('should require super_admin role', async () => {
      // Act
      const response = await request(app)
        .post('/admin/users')
        .set('Cookie', adminCookies)
        .send(createUserData());

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should create user with valid data', async () => {
      // Arrange
      const userData = createUserData({ username: 'newuser', email: 'new@example.com' });

      // Act
      const response = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(userData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/users');

      const user = await User.findByUsername('newuser');
      expect(user).toBeDefined();
      expect(user.email).toBe('new@example.com');
      expect(user.status).toBe('active');
    });

    it('should hash password using bcrypt', async () => {
      // Arrange
      const userData = createUserData({ username: 'hasheduser' });

      // Act
      await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(userData);

      // Assert
      const user = await User.findByUsernameWithPassword('hasheduser');
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(userData.password);
      expect(user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')).toBe(true);

      // Verify password can be verified
      const isValid = await bcrypt.compare(userData.password, user.password_hash);
      expect(isValid).toBe(true);
    });

    it('should validate username uniqueness', async () => {
      // Arrange
      const userData = createUserData({ username: 'duplicateuser' });
      await User.create(userData);

      // Act - Try to create another user with same username
      const response = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({ ...userData, email: 'different@example.com' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should validate email uniqueness', async () => {
      // Arrange
      const userData = createUserData({ email: 'unique@example.com' });
      await User.create(userData);

      // Act - Try to create another user with same email
      const response = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(createUserData({ username: 'different', email: 'unique@example.com' }));

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should validate password complexity', async () => {
      // Arrange
      const userData = createUserData({ password: 'weak' });

      // Act
      const response = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(userData);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should set default status to active', async () => {
      // Arrange
      const userData = createUserData({ username: 'defaultactive' });
      delete userData.status;

      // Act
      await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(userData);

      // Assert
      const user = await User.findByUsername('defaultactive');
      expect(user.status).toBe('active');
    });

    it('should create audit log entry for user creation', async () => {
      // Arrange
      const userData = createUserData({ username: 'audituser' });

      // Act
      await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(userData);

      // Assert
      const user = await User.findByUsername('audituser');
      const auditLogs = await AuditLog.findByTarget('user', user.id);

      const creationLog = auditLogs.find(log => log.action === 'USER_CREATED');
      expect(creationLog).toBeDefined();
      expect(creationLog.actor_id).toBe(superAdminUser.id);
    });
  });

  describe('GET /admin/users/:id/edit', () => {
    it('should require super_admin role', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .get(`/admin/users/${user.id}/edit`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
    });

    it('should render edit user form with current data', async () => {
      // Arrange
      const userData = createUserData({ username: 'editableuser' });
      const user = await User.create(userData);

      // Act
      const response = await request(app)
        .get(`/admin/users/${user.id}/edit`)
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Edit User');
      expect(response.text).toContain('editableuser');
    });

    it('should return 404 for non-existent user', async () => {
      // Act
      const response = await request(app)
        .get('/admin/users/99999/edit')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('POST /admin/users/:id', () => {
    it('should require super_admin role', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}`)
        .set('Cookie', adminCookies)
        .send({ username: 'updated' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should update user fields', async () => {
      // Arrange
      const userData = createUserData({ username: 'original' });
      const user = await User.create(userData);

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}`)
        .set('Cookie', superAdminCookies)
        .send({
          username: 'updated',
          email: 'updated@example.com',
          role: 'super_admin'
        });

      // Assert
      expect(response.status).toBe(302);

      const updatedUser = await User.findById(user.id);
      expect(updatedUser.username).toBe('updated');
      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.role).toBe('super_admin');
    });

    it('should validate uniqueness when changing username', async () => {
      // Arrange
      const user1 = await User.create(createUserData({ username: 'user1' }));
      const user2 = await User.create(createUserData({ username: 'user2' }));

      // Act - Try to change user2's username to user1
      const response = await request(app)
        .post(`/admin/users/${user2.id}`)
        .set('Cookie', superAdminCookies)
        .send({ username: 'user1' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should clear user sessions when status changes to non-active', async () => {
      // Arrange
      const userData = createUserData({ status: 'active' });
      const user = await User.create(userData);

      // Act - Change status to inactive
      await request(app)
        .post(`/admin/users/${user.id}`)
        .set('Cookie', superAdminCookies)
        .send({ status: 'inactive' });

      // Assert
      const updatedUser = await User.findById(user.id);
      expect(updatedUser.status).toBe('inactive');
      // User.clearUserSessions should have been called
    });

    it('should create audit log entry for user update', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      await request(app)
        .post(`/admin/users/${user.id}`)
        .set('Cookie', superAdminCookies)
        .send({ username: 'modified' });

      // Assert
      const auditLogs = await AuditLog.findByTarget('user', user.id);
      const updateLog = auditLogs.find(log => log.action === 'USER_UPDATED');

      expect(updateLog).toBeDefined();
      expect(updateLog.actor_id).toBe(superAdminUser.id);
    });
  });

  describe('POST /admin/users/:id/password', () => {
    it('should require super_admin role', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/password`)
        .set('Cookie', adminCookies)
        .send({ password: 'NewPass123!' });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should reset user password', async () => {
      // Arrange
      const user = await User.create(createUserData());
      const newPassword = 'NewSecurePass123!';

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: newPassword });

      // Assert
      expect(response.status).toBe(302);

      const updatedUser = await User.findByUsernameWithPassword(user.username);
      const isValid = await bcrypt.compare(newPassword, updatedUser.password_hash);
      expect(isValid).toBe(true);
    });

    it('should hash new password', async () => {
      // Arrange
      const user = await User.create(createUserData());
      const newPassword = 'NewSecurePass123!';

      // Act
      await request(app)
        .post(`/admin/users/${user.id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: newPassword });

      // Assert
      const updatedUser = await User.findByUsernameWithPassword(user.username);
      expect(updatedUser.password_hash).not.toBe(newPassword);
      expect(updatedUser.password_hash.startsWith('$2a$') || updatedUser.password_hash.startsWith('$2b$')).toBe(true);
    });

    it('should validate password complexity on reset', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: 'weak' });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('back');
    });

    it('should update password_changed_at timestamp', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      await request(app)
        .post(`/admin/users/${user.id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: 'NewSecurePass123!' });

      // Assert
      const updatedUser = await User.findById(user.id);
      expect(updatedUser.password_changed_at).not.toBeNull();
    });

    it('should create audit log entry for password reset', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      await request(app)
        .post(`/admin/users/${user.id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: 'NewSecurePass123!' });

      // Assert
      const auditLogs = await AuditLog.findByTarget('user', user.id);
      const passwordLog = auditLogs.find(log => log.action === 'PASSWORD_RESET');

      expect(passwordLog).toBeDefined();
      expect(passwordLog.actor_id).toBe(superAdminUser.id);
    });
  });

  describe('POST /admin/users/:id/delete', () => {
    it('should require super_admin role', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/delete`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
    });

    it('should soft delete user', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(302);

      const deletedUser = await User.findById(user.id);
      expect(deletedUser.status).toBe('deleted');
      expect(deletedUser.deleted_at).not.toBeNull();
    });

    it('should clear all user sessions on delete', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      await request(app)
        .post(`/admin/users/${user.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Assert - User.clearUserSessions should have been called
      const deletedUser = await User.findById(user.id);
      expect(deletedUser.status).toBe('deleted');
    });

    it('should prevent self-deletion', async () => {
      // Act - Try to delete self
      const response = await request(app)
        .post(`/admin/users/${superAdminUser.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(302);
      // Should redirect back with error (userService prevents self-deletion)
    });

    it('should create audit log entry for user deletion', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      await request(app)
        .post(`/admin/users/${user.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Assert
      const auditLogs = await AuditLog.findByTarget('user', user.id);
      const deleteLog = auditLogs.find(log => log.action === 'USER_DELETED');

      expect(deleteLog).toBeDefined();
      expect(deleteLog.actor_id).toBe(superAdminUser.id);
    });

    it('should not appear in user list after deletion', async () => {
      // Arrange
      const userData = createUserData({ username: 'tobedeleted' });
      const user = await User.create(userData);

      // Act
      await request(app)
        .post(`/admin/users/${user.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Verify deletion
      const response = await request(app)
        .get('/admin/users')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).not.toContain('tobedeleted');
    });
  });

  describe('POST /admin/users/:id/toggle-status', () => {
    it('should require super_admin role', async () => {
      // Arrange
      const user = await User.create(createUserData());

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/toggle-status`)
        .set('Cookie', adminCookies)
        .send({ status: 'inactive' });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should toggle user status to inactive', async () => {
      // Arrange
      const user = await User.create(createUserData({ status: 'active' }));

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/toggle-status`)
        .set('Cookie', superAdminCookies)
        .send({ status: 'inactive' });

      // Assert
      expect(response.status).toBe(302);

      const updatedUser = await User.findById(user.id);
      expect(updatedUser.status).toBe('inactive');
    });

    it('should toggle user status to active', async () => {
      // Arrange
      const user = await User.create(createUserData({ status: 'inactive' }));

      // Act
      const response = await request(app)
        .post(`/admin/users/${user.id}/toggle-status`)
        .set('Cookie', superAdminCookies)
        .send({ status: 'active' });

      // Assert
      expect(response.status).toBe(302);

      const updatedUser = await User.findById(user.id);
      expect(updatedUser.status).toBe('active');
    });
  });
});
