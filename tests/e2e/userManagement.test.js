/**
 * User Management End-to-End Tests
 *
 * Tests complete user lifecycle from start to finish:
 * - User creation → Login → Role changes → Password reset → Deactivation → Deletion
 * - Session clearing on status changes
 * - Super admin permissions throughout workflow
 * - Complete audit trail verification
 *
 * These tests validate the entire user management system working together.
 */

const request = require('supertest');
const app = require('../../app');
const { setupTestDatabase, teardownTestDatabase, getTestClient } = require('../helpers/database');
const { createUserData } = require('../helpers/factories');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const bcrypt = require('bcryptjs');

describe('User Management E2E Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('Complete User Lifecycle', () => {
    it('should complete full user management workflow', async () => {
      // Step 1: Super admin logs in
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      const superAdmin = await User.create(superAdminData, getTestClient());

      const superAdminLogin = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = superAdminLogin.headers['set-cookie'];
      expect(superAdminLogin.status).toBe(302);

      // Step 2: Super admin creates new admin user
      const newUserData = {
        username: 'newadmin',
        email: 'newadmin@example.com',
        password: 'SecurePass123!',
        role: 'admin'
      };

      const createResponse = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send(newUserData);

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toBe('/admin/users');

      // Step 3: Verify user created with hashed password
      const newUser = await User.findByUsername('newadmin');
      expect(newUser).toBeDefined();
      expect(newUser.email).toBe('newadmin@example.com');
      expect(newUser.role).toBe('admin');
      expect(newUser.status).toBe('active');

      const userWithPassword = await User.findByUsernameWithPassword('newadmin');
      expect(userWithPassword.password_hash).toBeDefined();
      expect(userWithPassword.password_hash).not.toBe('SecurePass123!');

      const passwordValid = await bcrypt.compare('SecurePass123!', userWithPassword.password_hash);
      expect(passwordValid).toBe(true);

      // Step 4: Logout super admin
      await request(app)
        .post('/auth/logout')
        .set('Cookie', superAdminCookies);

      // Step 5: New admin user logs in successfully
      const newUserLogin = await request(app)
        .post('/auth/login')
        .send({
          username: 'newadmin',
          password: 'SecurePass123!'
        });

      expect(newUserLogin.status).toBe(302);
      expect(newUserLogin.headers.location).toBe('/admin/dashboard');

      const newUserCookies = newUserLogin.headers['set-cookie'];

      // Step 6: Verify new user can access admin dashboard
      const dashboardResponse = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', newUserCookies);

      expect(dashboardResponse.status).toBe(200);

      // Step 7: Logout new admin
      await request(app)
        .post('/auth/logout')
        .set('Cookie', newUserCookies);

      // Step 8: Super admin logs in again
      const superAdminLogin2 = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies2 = superAdminLogin2.headers['set-cookie'];

      // Step 9: Super admin updates new user's role to super_admin
      const updateRoleResponse = await request(app)
        .post(`/admin/users/${newUser.id}`)
        .set('Cookie', superAdminCookies2)
        .send({
          username: 'newadmin',
          email: 'newadmin@example.com',
          role: 'super_admin'
        });

      expect(updateRoleResponse.status).toBe(302);

      const userAfterRoleUpdate = await User.findById(newUser.id);
      expect(userAfterRoleUpdate.role).toBe('super_admin');

      // Step 10: Super admin resets user's password
      const newPassword = 'NewSecurePass456!';
      const resetPasswordResponse = await request(app)
        .post(`/admin/users/${newUser.id}/password`)
        .set('Cookie', superAdminCookies2)
        .send({ password: newPassword });

      expect(resetPasswordResponse.status).toBe(302);

      // Step 11: Verify password_changed_at updated
      const userAfterPasswordReset = await User.findById(newUser.id);
      expect(userAfterPasswordReset.password_changed_at).not.toBeNull();

      const userWithNewPassword = await User.findByUsernameWithPassword('newadmin');
      const newPasswordValid = await bcrypt.compare(newPassword, userWithNewPassword.password_hash);
      expect(newPasswordValid).toBe(true);

      // Step 12: Verify old password no longer works
      const oldPasswordValid = await bcrypt.compare('SecurePass123!', userWithNewPassword.password_hash);
      expect(oldPasswordValid).toBe(false);

      // Step 13: New user can login with new password
      const newPasswordLogin = await request(app)
        .post('/auth/login')
        .send({
          username: 'newadmin',
          password: newPassword
        });

      expect(newPasswordLogin.status).toBe(302);

      const newPasswordCookies = newPasswordLogin.headers['set-cookie'];

      // Step 14: Super admin deactivates user (status = 'inactive')
      const deactivateResponse = await request(app)
        .post(`/admin/users/${newUser.id}`)
        .set('Cookie', superAdminCookies2)
        .send({
          username: 'newadmin',
          email: 'newadmin@example.com',
          role: 'super_admin',
          status: 'inactive'
        });

      expect(deactivateResponse.status).toBe(302);

      // Step 15: Verify user's sessions cleared (User.clearUserSessions called)
      const deactivatedUser = await User.findById(newUser.id);
      expect(deactivatedUser.status).toBe('inactive');

      // Step 16: Attempt login as deactivated user (should fail)
      const deactivatedLoginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: 'newadmin',
          password: newPassword
        });

      expect(deactivatedLoginResponse.status).toBe(302);
      expect(deactivatedLoginResponse.headers.location).toBe('/auth/login');
      expect(deactivatedLoginResponse.headers['set-cookie']).toBeUndefined();

      // Step 17: Verify existing session is invalidated
      const sessionCheckResponse = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', newPasswordCookies);

      expect(sessionCheckResponse.status).toBe(302);
      expect(sessionCheckResponse.headers.location).toBe('/auth/login');

      // Step 18: Super admin deletes user (soft delete)
      const deleteResponse = await request(app)
        .post(`/admin/users/${newUser.id}/delete`)
        .set('Cookie', superAdminCookies2);

      expect(deleteResponse.status).toBe(302);

      // Step 19: Verify deleted_at timestamp set
      const deletedUser = await User.findById(newUser.id);
      expect(deletedUser.status).toBe('deleted');
      expect(deletedUser.deleted_at).not.toBeNull();
      expect(new Date(deletedUser.deleted_at)).toBeInstanceOf(Date);

      // Step 20: Verify user no longer appears in user list
      const userListResponse = await request(app)
        .get('/admin/users')
        .set('Cookie', superAdminCookies2);

      expect(userListResponse.status).toBe(200);
      expect(userListResponse.text).not.toContain('newadmin');

      // Step 21: Verify complete audit trail
      const auditLogs = await AuditLog.findByTarget('user', newUser.id);
      expect(auditLogs.length).toBeGreaterThan(0);

      // Verify creation log
      const creationLog = auditLogs.find(log => log.action === 'USER_CREATED');
      expect(creationLog).toBeDefined();
      expect(creationLog.actor_id).toBe(superAdmin.id);

      // Verify update log
      const updateLog = auditLogs.find(log => log.action === 'USER_UPDATED');
      expect(updateLog).toBeDefined();

      // Verify password reset log
      const passwordLog = auditLogs.find(log => log.action === 'PASSWORD_RESET');
      expect(passwordLog).toBeDefined();

      // Verify deletion log
      const deleteLog = auditLogs.find(log => log.action === 'USER_DELETED');
      expect(deleteLog).toBeDefined();
    });
  });

  describe('Permission Enforcement', () => {
    it('should enforce super_admin permission throughout workflow', async () => {
      // Step 1: Create regular admin (not super_admin)
      const adminData = createUserData({ role: 'admin', status: 'active' });
      await User.create(adminData, getTestClient());

      const adminLogin = await request(app)
        .post('/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        });

      const adminCookies = adminLogin.headers['set-cookie'];

      // Step 2: Try to access user management (should fail)
      const listResponse = await request(app)
        .get('/admin/users')
        .set('Cookie', adminCookies);

      expect(listResponse.status).toBe(302);
      expect(listResponse.headers.location).toBe('/admin/dashboard');

      // Step 3: Try to create user (should fail)
      const createResponse = await request(app)
        .post('/admin/users')
        .set('Cookie', adminCookies)
        .send(createUserData());

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toBe('/admin/dashboard');

      // Step 4: Create super_admin for comparison
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      await User.create(superAdminData, getTestClient());

      const superAdminLogin = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = superAdminLogin.headers['set-cookie'];

      // Step 5: Super admin can access user management
      const superAdminListResponse = await request(app)
        .get('/admin/users')
        .set('Cookie', superAdminCookies);

      expect(superAdminListResponse.status).toBe(200);
      expect(superAdminListResponse.text).toContain('User Management');
    });
  });

  describe('Self-Deletion Prevention', () => {
    it('should prevent super admin from deleting themselves', async () => {
      // Arrange
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      const superAdmin = await User.create(superAdminData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = loginResponse.headers['set-cookie'];

      // Act - Try to delete self
      const deleteResponse = await request(app)
        .post(`/admin/users/${superAdmin.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Assert - Should be rejected
      expect(deleteResponse.status).toBe(302);

      // Verify user not deleted
      const userCheck = await User.findById(superAdmin.id);
      expect(userCheck.status).toBe('active');
      expect(userCheck.deleted_at).toBeNull();
    });
  });

  describe('Session Clearing Workflow', () => {
    it('should clear sessions when user status changes to inactive', async () => {
      // Step 1: Create super admin
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      const superAdmin = await User.create(superAdminData, getTestClient());

      const superAdminLogin = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = superAdminLogin.headers['set-cookie'];

      // Step 2: Create target user and login
      const targetUserData = createUserData({ role: 'admin', status: 'active' });
      const targetUser = await User.create(targetUserData, getTestClient());

      const targetUserLogin = await request(app)
        .post('/auth/login')
        .send({
          username: targetUserData.username,
          password: targetUserData.password
        });

      const targetUserCookies = targetUserLogin.headers['set-cookie'];

      // Step 3: Verify target user can access dashboard
      const beforeDeactivate = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', targetUserCookies);

      expect(beforeDeactivate.status).toBe(200);

      // Step 4: Super admin deactivates target user
      await request(app)
        .post(`/admin/users/${targetUser.id}`)
        .set('Cookie', superAdminCookies)
        .send({
          username: targetUserData.username,
          email: targetUserData.email,
          role: 'admin',
          status: 'inactive'
        });

      // Step 5: Verify target user's session is invalidated
      const afterDeactivate = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', targetUserCookies);

      expect(afterDeactivate.status).toBe(302);
      expect(afterDeactivate.headers.location).toBe('/auth/login');
    });

    it('should clear sessions when user is deleted', async () => {
      // Arrange
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      const superAdmin = await User.create(superAdminData, getTestClient());

      const superAdminLogin = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = superAdminLogin.headers['set-cookie'];

      const targetUserData = createUserData({ role: 'admin', status: 'active' });
      const targetUser = await User.create(targetUserData, getTestClient());

      const targetUserLogin = await request(app)
        .post('/auth/login')
        .send({
          username: targetUserData.username,
          password: targetUserData.password
        });

      const targetUserCookies = targetUserLogin.headers['set-cookie'];

      // Act - Delete user
      await request(app)
        .post(`/admin/users/${targetUser.id}/delete`)
        .set('Cookie', superAdminCookies);

      // Assert - Session should be invalidated
      const afterDelete = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', targetUserCookies);

      expect(afterDelete.status).toBe(302);
      expect(afterDelete.headers.location).toBe('/auth/login');
    });
  });

  describe('Password Security', () => {
    it('should enforce password complexity throughout workflow', async () => {
      // Arrange
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      await User.create(superAdminData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = loginResponse.headers['set-cookie'];

      // Act - Try to create user with weak password
      const weakPasswordResponse = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
          role: 'admin'
        });

      // Assert - Should be rejected
      expect(weakPasswordResponse.status).toBe(302);
      expect(weakPasswordResponse.headers.location).toBe('back');

      // Verify user not created
      const userCheck = await User.findByUsername('testuser');
      expect(userCheck).toBeNull();
    });

    it('should hash passwords using bcrypt', async () => {
      // Arrange
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      await User.create(superAdminData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = loginResponse.headers['set-cookie'];

      const password = 'TestPass123!';

      // Act - Create user
      await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({
          username: 'hashtest',
          email: 'hashtest@example.com',
          password: password,
          role: 'admin'
        });

      // Assert
      const user = await User.findByUsernameWithPassword('hashtest');
      expect(user.password_hash).not.toBe(password);
      expect(user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')).toBe(true);

      const isValid = await bcrypt.compare(password, user.password_hash);
      expect(isValid).toBe(true);
    });
  });

  describe('Uniqueness Validation', () => {
    it('should enforce username uniqueness throughout workflow', async () => {
      // Arrange
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      await User.create(superAdminData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = loginResponse.headers['set-cookie'];

      // Create first user
      await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({
          username: 'uniquetest',
          email: 'unique1@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        });

      // Act - Try to create another user with same username
      const duplicateResponse = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({
          username: 'uniquetest',
          email: 'unique2@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        });

      // Assert - Should be rejected
      expect(duplicateResponse.status).toBe(302);
      expect(duplicateResponse.headers.location).toBe('back');
    });

    it('should enforce email uniqueness throughout workflow', async () => {
      // Arrange
      const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
      await User.create(superAdminData, getTestClient());

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: superAdminData.username,
          password: superAdminData.password
        });

      const superAdminCookies = loginResponse.headers['set-cookie'];

      // Create first user
      await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({
          username: 'user1',
          email: 'duplicate@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        });

      // Act - Try to create another user with same email
      const duplicateResponse = await request(app)
        .post('/admin/users')
        .set('Cookie', superAdminCookies)
        .send({
          username: 'user2',
          email: 'duplicate@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        });

      // Assert - Should be rejected
      expect(duplicateResponse.status).toBe(302);
      expect(duplicateResponse.headers.location).toBe('back');
    });
  });
});
