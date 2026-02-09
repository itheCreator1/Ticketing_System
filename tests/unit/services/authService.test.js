/**
 * AuthService Unit Tests
 *
 * Tests authentication service with focus on security:
 * - Timing attack prevention
 * - Account locking
 * - User enumeration prevention
 * - Status validation
 */

const authService = require('../../../services/authService');
const User = require('../../../models/User');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../../../models/User');
jest.mock('bcryptjs');
jest.mock('../../../utils/logger');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    describe('successful authentication', () => {
      it('should return user on valid credentials', async () => {
        // Arrange
        const mockUser = {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          password_hash: 'hashed_password',
          role: 'admin',
          status: 'active',
          login_attempts: 0,
        };
        User.findByUsernameWithPassword.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        User.updateLastLogin.mockResolvedValue();

        // Act
        const result = await authService.authenticate('testuser', 'ValidPass123!');

        // Assert
        expect(result).toEqual(mockUser);
        expect(User.findByUsernameWithPassword).toHaveBeenCalledWith('testuser');
        expect(bcrypt.compare).toHaveBeenCalledWith('ValidPass123!', 'hashed_password');
        expect(User.updateLastLogin).toHaveBeenCalledWith(1);
      });

      it('should reset login attempts on successful authentication', async () => {
        // Arrange
        const mockUser = {
          id: 1,
          username: 'testuser',
          password_hash: 'hashed_password',
          status: 'active',
          login_attempts: 3,
        };
        User.findByUsernameWithPassword.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        User.updateLastLogin.mockResolvedValue();

        // Act
        await authService.authenticate('testuser', 'ValidPass123!');

        // Assert
        expect(User.updateLastLogin).toHaveBeenCalledWith(1);
      });
    });

    describe('timing attack prevention', () => {
      it('should perform dummy hash comparison for non-existent users', async () => {
        // Arrange
        User.findByUsernameWithPassword.mockResolvedValue(null);
        bcrypt.compare.mockResolvedValue(false);

        // Act
        const result = await authService.authenticate('nonexistent', 'password123');

        // Assert
        expect(result).toBeNull();
        expect(bcrypt.compare).toHaveBeenCalledWith(
          'password123',
          expect.stringContaining('$2a$10$invalidhash')
        );
      });

      it('should take similar time for existing and non-existing users', async () => {
        // Arrange
        const existingUser = {
          id: 1,
          username: 'exists',
          password_hash: '$2a$10$validhash',
          status: 'active',
          login_attempts: 0,
        };

        // Test with existing user
        User.findByUsernameWithPassword.mockResolvedValue(existingUser);
        bcrypt.compare.mockResolvedValue(false);

        const start1 = Date.now();
        await authService.authenticate('exists', 'wrongpass');
        const duration1 = Date.now() - start1;

        // Test with non-existing user
        User.findByUsernameWithPassword.mockResolvedValue(null);
        bcrypt.compare.mockResolvedValue(false);

        const start2 = Date.now();
        await authService.authenticate('notexists', 'wrongpass');
        const duration2 = Date.now() - start2;

        // Assert - times should be comparable (within reasonable margin)
        // Both should call bcrypt.compare
        expect(bcrypt.compare).toHaveBeenCalledTimes(2);
        expect(Math.abs(duration1 - duration2)).toBeLessThan(50); // Within 50ms
      });
    });

    describe('account locking', () => {
      it('should return null when login_attempts >= 5', async () => {
        // Arrange
        const lockedUser = {
          id: 1,
          username: 'lockeduser',
          password_hash: 'hashed_password',
          status: 'active',
          login_attempts: 5,
        };
        User.findByUsernameWithPassword.mockResolvedValue(lockedUser);
        bcrypt.compare.mockResolvedValue(true); // Even with correct password

        // Act
        const result = await authService.authenticate('lockeduser', 'ValidPass123!');

        // Assert
        expect(result).toBeNull();
        expect(User.updateLastLogin).not.toHaveBeenCalled();
      });

      it('should not reveal account lock status to prevent enumeration', async () => {
        // Arrange - locked account
        const lockedUser = {
          id: 1,
          username: 'lockeduser',
          password_hash: 'hashed',
          status: 'active',
          login_attempts: 5,
        };
        User.findByUsernameWithPassword.mockResolvedValue(lockedUser);
        bcrypt.compare.mockResolvedValue(true);

        // Act
        const result = await authService.authenticate('lockeduser', 'password');

        // Assert - returns null just like wrong password
        expect(result).toBeNull();
      });

      it('should allow login when login_attempts < 5', async () => {
        // Arrange
        const user = {
          id: 1,
          username: 'user',
          password_hash: 'hashed',
          status: 'active',
          login_attempts: 4,
        };
        User.findByUsernameWithPassword.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        User.updateLastLogin.mockResolvedValue();

        // Act
        const result = await authService.authenticate('user', 'password');

        // Assert
        expect(result).toEqual(user);
        expect(User.updateLastLogin).toHaveBeenCalledWith(1);
      });
    });

    describe('account status validation', () => {
      it('should return null when status is inactive', async () => {
        // Arrange
        const inactiveUser = {
          id: 1,
          username: 'inactive',
          password_hash: 'hashed_password',
          status: 'inactive',
          login_attempts: 0,
        };
        User.findByUsernameWithPassword.mockResolvedValue(inactiveUser);
        bcrypt.compare.mockResolvedValue(true);

        // Act
        const result = await authService.authenticate('inactive', 'ValidPass123!');

        // Assert
        expect(result).toBeNull();
        expect(User.updateLastLogin).not.toHaveBeenCalled();
      });

      it('should return null when status is deleted', async () => {
        // Arrange
        const deletedUser = {
          id: 1,
          username: 'deleted',
          password_hash: 'hashed_password',
          status: 'deleted',
          login_attempts: 0,
        };
        User.findByUsernameWithPassword.mockResolvedValue(deletedUser);
        bcrypt.compare.mockResolvedValue(true);

        // Act
        const result = await authService.authenticate('deleted', 'ValidPass123!');

        // Assert
        expect(result).toBeNull();
        expect(User.updateLastLogin).not.toHaveBeenCalled();
      });

      it('should succeed only when status is active', async () => {
        // Arrange
        const activeUser = {
          id: 1,
          username: 'active',
          password_hash: 'hashed_password',
          status: 'active',
          login_attempts: 0,
        };
        User.findByUsernameWithPassword.mockResolvedValue(activeUser);
        bcrypt.compare.mockResolvedValue(true);
        User.updateLastLogin.mockResolvedValue();

        // Act
        const result = await authService.authenticate('active', 'ValidPass123!');

        // Assert
        expect(result).toEqual(activeUser);
        expect(User.updateLastLogin).toHaveBeenCalledWith(1);
      });
    });

    describe('password validation', () => {
      it('should return null for incorrect password', async () => {
        // Arrange
        const user = {
          id: 1,
          username: 'testuser',
          password_hash: 'hashed_password',
          status: 'active',
          login_attempts: 0,
        };
        User.findByUsernameWithPassword.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(false);
        User.incrementLoginAttempts.mockResolvedValue();

        // Act
        const result = await authService.authenticate('testuser', 'wrongpassword');

        // Assert
        expect(result).toBeNull();
        expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashed_password');
      });

      it('should increment login_attempts on failed password', async () => {
        // Arrange
        const user = {
          id: 1,
          username: 'testuser',
          password_hash: 'hashed_password',
          status: 'active',
          login_attempts: 2,
        };
        User.findByUsernameWithPassword.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(false);
        User.incrementLoginAttempts.mockResolvedValue();

        // Act
        await authService.authenticate('testuser', 'wrongpassword');

        // Assert
        expect(User.incrementLoginAttempts).toHaveBeenCalledWith('testuser');
      });

      it('should not increment login_attempts on successful password', async () => {
        // Arrange
        const user = {
          id: 1,
          username: 'testuser',
          password_hash: 'hashed_password',
          status: 'active',
          login_attempts: 0,
        };
        User.findByUsernameWithPassword.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        User.updateLastLogin.mockResolvedValue();

        // Act
        await authService.authenticate('testuser', 'correctpassword');

        // Assert
        expect(User.incrementLoginAttempts).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should throw error when database fails', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        User.findByUsernameWithPassword.mockRejectedValue(dbError);

        // Act & Assert
        await expect(authService.authenticate('testuser', 'password')).rejects.toThrow(
          'Database connection failed'
        );
      });

      it('should throw error when bcrypt fails', async () => {
        // Arrange
        const user = { id: 1, username: 'test', password_hash: 'hash', status: 'active' };
        User.findByUsernameWithPassword.mockResolvedValue(user);
        bcrypt.compare.mockRejectedValue(new Error('bcrypt error'));

        // Act & Assert
        await expect(authService.authenticate('test', 'password')).rejects.toThrow('bcrypt error');
      });
    });
  });

  describe('createSessionData', () => {
    it('should return only safe user fields', () => {
      // Arrange
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        password_hash: 'should_not_be_included',
        login_attempts: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const sessionData = authService.createSessionData(user);

      // Assert
      expect(sessionData).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
      });
    });

    it('should not include password_hash', () => {
      // Arrange
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        password_hash: 'sensitive_hash',
      };

      // Act
      const sessionData = authService.createSessionData(user);

      // Assert
      expect(sessionData.password_hash).toBeUndefined();
    });

    it('should not include sensitive timestamps', () => {
      // Arrange
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: new Date(),
        password_changed_at: new Date(),
      };

      // Act
      const sessionData = authService.createSessionData(user);

      // Assert
      expect(sessionData.created_at).toBeUndefined();
      expect(sessionData.updated_at).toBeUndefined();
      expect(sessionData.last_login_at).toBeUndefined();
      expect(sessionData.password_changed_at).toBeUndefined();
    });
  });
});
