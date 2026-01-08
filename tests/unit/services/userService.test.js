/**
 * UserService Unit Tests
 * Tests the UserService in complete isolation with all dependencies mocked.
 * Covers all 9 methods with success, failure, edge cases, and business rule validation.
 *
 * Methods tested:
 * - getUserById(id)
 * - getUserByUsername(username)
 * - getAllUsers()
 * - createUser(userData)
 * - changePassword(userId, currentPassword, newPassword)
 * - updateUser(actorId, targetId, updates, ipAddress)
 * - deleteUser(actorId, targetId, ipAddress)
 * - resetUserPassword(actorId, targetId, newPassword, ipAddress)
 * - toggleUserStatus(actorId, targetId, newStatus, ipAddress)
 */

const userService = require('../../../services/userService');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../../../utils/passwordValidator');
const { createUserData } = require('../../helpers/factories');

// Mock dependencies
jest.mock('../../../models/User');
jest.mock('../../../models/AuditLog');
jest.mock('bcryptjs');
jest.mock('../../../utils/passwordValidator');
jest.mock('../../../utils/logger');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
      User.findById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserById(1);

      // Assert
      expect(result).toEqual(mockUser);
      expect(User.findById).toHaveBeenCalledWith(1);
    });

    it('should return undefined when user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(undefined);

      // Act
      const result = await userService.getUserById(999);

      // Assert
      expect(result).toBeUndefined();
      expect(User.findById).toHaveBeenCalledWith(999);
    });

    it('should propagate database errors', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      User.findById.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userService.getUserById(1)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getUserByUsername', () => {
    it('should return user when found', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'johndoe', email: 'john@example.com' };
      User.findByUsername.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserByUsername('johndoe');

      // Assert
      expect(result).toEqual(mockUser);
      expect(User.findByUsername).toHaveBeenCalledWith('johndoe');
    });

    it('should return undefined when user not found', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(undefined);

      // Act
      const result = await userService.getUserByUsername('nonexistent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAllUsers', () => {
    it('should return all active users', async () => {
      // Arrange
      const mockUsers = [
        { id: 1, username: 'user1', status: 'active' },
        { id: 2, username: 'user2', status: 'active' }
      ];
      User.findAllActive.mockResolvedValue(mockUsers);

      // Act
      const result = await userService.getAllUsers();

      // Assert
      expect(result).toEqual(mockUsers);
      expect(User.findAllActive).toHaveBeenCalled();
    });

    it('should return empty array when no users', async () => {
      // Arrange
      User.findAllActive.mockResolvedValue([]);

      // Act
      const result = await userService.getAllUsers();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = createUserData({ username: 'newuser', email: 'new@test.com' });
      const mockCreatedUser = { id: 10, ...userData };
      User.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(mockCreatedUser);
      expect(User.create).toHaveBeenCalledWith(userData);
    });

    it('should create department user with department field', async () => {
      // Arrange
      const userData = createUserData({ role: 'department', department: 'IT Support' });
      const mockCreatedUser = { id: 10, ...userData };
      User.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(mockCreatedUser);
      expect(User.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error when creating department user without department', async () => {
      // Arrange
      // Manually create userData to bypass factory's auto-add logic
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'ValidPass123!',
        role: 'department'
        // Deliberately omit department field
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Department is required for department role users');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should throw error when non-department user has department set', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin', department: 'IT Support' });

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Department can only be set for department role users');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      // Arrange
      const userData = createUserData();
      const dbError = new Error('Duplicate username');
      User.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Duplicate username');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully with valid current password', async () => {
      // Arrange
      const userId = 5;
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';
      const mockUser = {
        id: userId,
        username: 'testuser',
        password_hash: 'hashed_old_password'
      };

      User.findById.mockResolvedValue({ username: 'testuser' });
      User.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      validatePassword.mockReturnValue({ isValid: true, errors: [] });
      User.updatePassword.mockResolvedValue(true);

      // Act
      const result = await userService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, mockUser.password_hash);
      expect(validatePassword).toHaveBeenCalledWith(newPassword);
      expect(User.updatePassword).toHaveBeenCalledWith(userId, newPassword);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue({ username: 'testuser' });
      User.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.changePassword(999, 'OldPass123!', 'NewPass456!')
      ).rejects.toThrow('User not found');
    });

    it('should throw error when current password is incorrect', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        password_hash: 'hashed_password'
      };

      User.findById.mockResolvedValue({ username: 'testuser' });
      User.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(
        userService.changePassword(1, 'WrongPassword123!', 'NewPassword456!')
      ).rejects.toThrow('Current password is incorrect');
      expect(User.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw error when new password is invalid (too short)', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        password_hash: 'hashed_password'
      };

      User.findById.mockResolvedValue({ username: 'testuser' });
      User.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      validatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters']
      });

      // Act & Assert
      await expect(
        userService.changePassword(1, 'OldPass123!', 'short')
      ).rejects.toThrow('Password must be at least 8 characters');
      expect(User.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw error when new password lacks complexity', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        password_hash: 'hashed_password'
      };

      User.findById.mockResolvedValue({ username: 'testuser' });
      User.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      validatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password must contain uppercase letter', 'Password must contain special character']
      });

      // Act & Assert
      await expect(
        userService.changePassword(1, 'OldPass123!', 'lowercase123')
      ).rejects.toThrow('Password must contain uppercase letter, Password must contain special character');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Arrange
      const actorId = 1;
      const targetId = 5;
      const updates = { email: 'newemail@test.com' };
      const ipAddress = '192.168.1.100';

      const mockTargetUser = { id: 5, username: 'target', role: 'admin', status: 'active' };
      const mockUpdatedUser = { ...mockTargetUser, email: 'newemail@test.com' };

      User.findById.mockResolvedValue(mockTargetUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.updateUser(actorId, targetId, updates, ipAddress);

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(User.update).toHaveBeenCalledWith(targetId, updates);
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId,
        action: 'USER_UPDATED',
        targetType: 'user',
        targetId,
        details: { changes: updates },
        ipAddress
      });
    });

    it('should throw error when target user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUser(1, 999, { email: 'new@test.com' }, '127.0.0.1')
      ).rejects.toThrow('User not found');
      expect(User.update).not.toHaveBeenCalled();
    });

    it('should prevent downgrading last super_admin', async () => {
      // Arrange
      const mockSuperAdmin = { id: 1, username: 'lastadmin', role: 'super_admin', status: 'active' };
      User.findById.mockResolvedValue(mockSuperAdmin);
      User.countActiveSuperAdmins.mockResolvedValue(1);

      // Act & Assert
      await expect(
        userService.updateUser(2, 1, { role: 'admin' }, '127.0.0.1')
      ).rejects.toThrow('Cannot downgrade the last super admin');
      expect(User.update).not.toHaveBeenCalled();
    });

    it('should allow downgrading super_admin when multiple exist', async () => {
      // Arrange
      const mockSuperAdmin = { id: 1, username: 'admin1', role: 'super_admin', status: 'active' };
      const mockUpdatedUser = { ...mockSuperAdmin, role: 'admin' };

      User.findById.mockResolvedValue(mockSuperAdmin);
      User.countActiveSuperAdmins.mockResolvedValue(3);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.updateUser(2, 1, { role: 'admin' }, '127.0.0.1');

      // Assert
      expect(result.role).toBe('admin');
      expect(User.update).toHaveBeenCalled();
    });

    it('should prevent deactivating last super_admin', async () => {
      // Arrange
      const mockSuperAdmin = { id: 1, username: 'lastadmin', role: 'super_admin', status: 'active' };
      User.findById.mockResolvedValue(mockSuperAdmin);
      User.countActiveSuperAdmins.mockResolvedValue(1);

      // Act & Assert
      await expect(
        userService.updateUser(2, 1, { status: 'inactive' }, '127.0.0.1')
      ).rejects.toThrow('Cannot deactivate the last super admin');
    });

    it('should allow deactivating super_admin when multiple exist', async () => {
      // Arrange
      const mockSuperAdmin = { id: 1, username: 'admin1', role: 'super_admin', status: 'active' };
      const mockUpdatedUser = { ...mockSuperAdmin, status: 'inactive' };

      User.findById.mockResolvedValue(mockSuperAdmin);
      User.countActiveSuperAdmins.mockResolvedValue(2);
      User.update.mockResolvedValue(mockUpdatedUser);
      User.clearUserSessions.mockResolvedValue(3);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.updateUser(2, 1, { status: 'inactive' }, '127.0.0.1');

      // Assert
      expect(User.update).toHaveBeenCalled();
      expect(User.clearUserSessions).toHaveBeenCalledWith(1);
    });

    it('should clear sessions when status changes to inactive', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active' };
      const mockUpdatedUser = { ...mockUser, status: 'inactive' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      User.clearUserSessions.mockResolvedValue(2);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.updateUser(1, 5, { status: 'inactive' }, '127.0.0.1');

      // Assert
      expect(User.clearUserSessions).toHaveBeenCalledWith(5);
    });

    it('should clear sessions when status changes to deleted', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active' };
      const mockUpdatedUser = { ...mockUser, status: 'deleted' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      User.clearUserSessions.mockResolvedValue(1);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.updateUser(1, 5, { status: 'deleted' }, '127.0.0.1');

      // Assert
      expect(User.clearUserSessions).toHaveBeenCalledWith(5);
    });

    it('should not clear sessions when status remains active', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active' };
      const mockUpdatedUser = { ...mockUser, email: 'new@test.com' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.updateUser(1, 5, { email: 'new@test.com' }, '127.0.0.1');

      // Assert
      expect(User.clearUserSessions).not.toHaveBeenCalled();
    });

    it('should not clear sessions when status is not changed', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active' };
      const mockUpdatedUser = { ...mockUser, username: 'newusername' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.updateUser(1, 5, { username: 'newusername' }, '127.0.0.1');

      // Assert
      expect(User.clearUserSessions).not.toHaveBeenCalled();
    });

    it('should create audit log for user update', async () => {
      // Arrange
      const actorId = 2;
      const targetId = 10;
      const updates = { role: 'super_admin', status: 'active' };
      const ipAddress = '10.0.0.5';
      const mockUser = { id: 10, username: 'user10', role: 'admin', status: 'active' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue({ ...mockUser, ...updates });
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.updateUser(actorId, targetId, updates, ipAddress);

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'USER_UPDATED',
        targetType: 'user',
        targetId: 10,
        details: { changes: updates },
        ipAddress: '10.0.0.5'
      });
    });

    it('should throw error when changing to department role without department', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active', department: null };
      User.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        userService.updateUser(1, 5, { role: 'department' }, '127.0.0.1')
      ).rejects.toThrow('Department is required for department role users');
      expect(User.update).not.toHaveBeenCalled();
    });

    it('should allow changing to department role with department provided', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active', department: null };
      const mockUpdatedUser = { ...mockUser, role: 'department', department: 'IT Support' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.updateUser(1, 5, { role: 'department', department: 'IT Support' }, '127.0.0.1');

      // Assert
      expect(result.role).toBe('department');
      expect(result.department).toBe('IT Support');
      expect(User.update).toHaveBeenCalled();
    });

    it('should auto-clear department when changing from department to admin role', async () => {
      // Arrange
      const mockUser = { id: 5, username: 'user5', role: 'department', status: 'active', department: 'IT Support' };
      const mockUpdatedUser = { ...mockUser, role: 'admin', department: null };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.updateUser(1, 5, { role: 'admin' }, '127.0.0.1');

      // Assert
      expect(User.update).toHaveBeenCalledWith(5, { role: 'admin', department: null });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      // Arrange
      const actorId = 1;
      const targetId = 10;
      const ipAddress = '192.168.1.1';
      const mockTarget = { id: 10, username: 'victim', email: 'victim@test.com', role: 'admin' };

      User.findById.mockResolvedValue(mockTarget);
      User.softDelete.mockResolvedValue(true);
      User.clearUserSessions.mockResolvedValue(2);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.deleteUser(actorId, targetId, ipAddress);

      // Assert
      expect(result).toBe(true);
      expect(User.softDelete).toHaveBeenCalledWith(targetId);
      expect(User.clearUserSessions).toHaveBeenCalledWith(targetId);
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId,
        action: 'USER_DELETED',
        targetType: 'user',
        targetId,
        details: { deletedUser: { username: 'victim', email: 'victim@test.com', role: 'admin' } },
        ipAddress
      });
    });

    it('should throw error when target user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.deleteUser(1, 999, '127.0.0.1')
      ).rejects.toThrow('User not found');
      expect(User.softDelete).not.toHaveBeenCalled();
    });

    it('should prevent self-deletion', async () => {
      // Arrange
      const actorId = 5;
      const targetId = 5;
      const mockUser = { id: 5, username: 'self', role: 'admin' };

      User.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        userService.deleteUser(actorId, targetId, '127.0.0.1')
      ).rejects.toThrow('Cannot delete yourself');
      expect(User.softDelete).not.toHaveBeenCalled();
    });

    it('should prevent deleting last super_admin', async () => {
      // Arrange
      const mockSuperAdmin = { id: 1, username: 'lastadmin', role: 'super_admin' };

      User.findById.mockResolvedValue(mockSuperAdmin);
      User.countActiveSuperAdmins.mockResolvedValue(1);

      // Act & Assert
      await expect(
        userService.deleteUser(2, 1, '127.0.0.1')
      ).rejects.toThrow('Cannot delete the last super admin');
      expect(User.softDelete).not.toHaveBeenCalled();
    });

    it('should allow deleting super_admin when multiple exist', async () => {
      // Arrange
      const mockSuperAdmin = { id: 1, username: 'admin1', email: 'admin1@test.com', role: 'super_admin' };

      User.findById.mockResolvedValue(mockSuperAdmin);
      User.countActiveSuperAdmins.mockResolvedValue(3);
      User.softDelete.mockResolvedValue(true);
      User.clearUserSessions.mockResolvedValue(1);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.deleteUser(2, 1, '127.0.0.1');

      // Assert
      expect(result).toBe(true);
      expect(User.softDelete).toHaveBeenCalledWith(1);
    });

    it('should clear all sessions when user is deleted', async () => {
      // Arrange
      const mockUser = { id: 10, username: 'user10', email: 'user10@test.com', role: 'admin' };

      User.findById.mockResolvedValue(mockUser);
      User.softDelete.mockResolvedValue(true);
      User.clearUserSessions.mockResolvedValue(5);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.deleteUser(1, 10, '127.0.0.1');

      // Assert
      expect(User.clearUserSessions).toHaveBeenCalledWith(10);
    });
  });

  describe('resetUserPassword', () => {
    it('should reset password successfully', async () => {
      // Arrange
      const actorId = 1;
      const targetId = 5;
      const newPassword = 'NewSecure123!';
      const ipAddress = '192.168.1.50';
      const mockTarget = { id: 5, username: 'target' };

      User.findById.mockResolvedValue(mockTarget);
      validatePassword.mockReturnValue({ isValid: true, errors: [] });
      User.updatePassword.mockResolvedValue(true);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.resetUserPassword(actorId, targetId, newPassword, ipAddress);

      // Assert
      expect(result).toBe(true);
      expect(validatePassword).toHaveBeenCalledWith(newPassword);
      expect(User.updatePassword).toHaveBeenCalledWith(targetId, newPassword);
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId,
        action: 'PASSWORD_RESET',
        targetType: 'user',
        targetId,
        details: { resetBy: 'admin' },
        ipAddress
      });
    });

    it('should throw error when target user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.resetUserPassword(1, 999, 'NewPass123!', '127.0.0.1')
      ).rejects.toThrow('User not found');
      expect(User.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw error when new password is invalid', async () => {
      // Arrange
      const mockTarget = { id: 5, username: 'target' };

      User.findById.mockResolvedValue(mockTarget);
      validatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters', 'Password must contain special character']
      });

      // Act & Assert
      await expect(
        userService.resetUserPassword(1, 5, 'weak', '127.0.0.1')
      ).rejects.toThrow('Password must be at least 8 characters, Password must contain special character');
      expect(User.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('toggleUserStatus', () => {
    it('should delegate to updateUser correctly', async () => {
      // Arrange
      const actorId = 1;
      const targetId = 5;
      const newStatus = 'inactive';
      const ipAddress = '192.168.1.100';

      const mockUser = { id: 5, username: 'user5', role: 'admin', status: 'active' };
      const mockUpdatedUser = { ...mockUser, status: newStatus };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      User.clearUserSessions.mockResolvedValue(1);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await userService.toggleUserStatus(actorId, targetId, newStatus, ipAddress);

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(User.update).toHaveBeenCalledWith(targetId, { status: newStatus });
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        actorId,
        targetId,
        action: 'USER_UPDATED',
        details: { changes: { status: newStatus } }
      }));
    });

    it('should pass all parameters correctly to updateUser', async () => {
      // Arrange
      const mockUser = { id: 10, username: 'user10', role: 'admin', status: 'inactive' };
      const mockUpdatedUser = { ...mockUser, status: 'active' };

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUpdatedUser);
      AuditLog.create.mockResolvedValue({});

      // Act
      await userService.toggleUserStatus(2, 10, 'active', '10.0.0.1');

      // Assert
      expect(User.update).toHaveBeenCalledWith(10, { status: 'active' });
    });
  });
});
