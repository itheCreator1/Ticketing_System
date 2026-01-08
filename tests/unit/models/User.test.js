/**
 * User Model Unit Tests
 *
 * Tests the User model in complete isolation with all dependencies mocked.
 * Covers all 13 static methods with success, failure, and edge cases.
 */

const User = require('../../../models/User');
const { createMockPool } = require('../../helpers/mocks');
const { createUserData } = require('../../helpers/factories');

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('bcryptjs');
jest.mock('../../../utils/logger');

const pool = require('../../../config/database');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    Object.assign(pool, mockPool);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user without password_hash when user exists', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        status: 'active',
        department: null,
        created_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUser] });

      // Act
      const result = await User.findById(1);

      // Assert
      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, username, email, role, status, department, created_at'),
        [1]
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('password_hash'),
        expect.any(Array)
      );
    });

    it('should return undefined when user does not exist', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await User.findById(999);

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [999]
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(User.findById(1)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByUsername', () => {
    it('should return user without password_hash when found', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        status: 'active',
        login_attempts: 0
      };
      pool.query.mockResolvedValue({ rows: [mockUser] });

      // Act
      const result = await User.findByUsername('testuser');

      // Assert
      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE username = $1'),
        ['testuser']
      );
    });

    it('should return undefined when user not found', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await User.findByUsername('nonexistent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findByUsernameWithPassword', () => {
    it('should return user WITH password_hash for authentication', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'admin',
        status: 'active'
      };
      pool.query.mockResolvedValue({ rows: [mockUser] });

      // Act
      const result = await User.findByUsernameWithPassword('testuser');

      // Assert
      expect(result).toEqual(mockUser);
      expect(result.password_hash).toBe('hashed_password');
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = $1',
        ['testuser']
      );
    });

    it('should return undefined when user not found', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await User.findByUsernameWithPassword('nonexistent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };
      pool.query.mockResolvedValue({ rows: [mockUser] });

      // Act
      const result = await User.findByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        ['test@example.com']
      );
    });

    it('should return undefined when email not found', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await User.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const userData = createUserData();
      const hashedPassword = 'hashed_password_123';
      const mockCreatedUser = {
        id: 1,
        username: userData.username,
        email: userData.email,
        role: 'admin',
        department: null
      };

      bcrypt.hash.mockResolvedValue(hashedPassword);
      pool.query.mockResolvedValue({ rows: [mockCreatedUser] });

      // Act
      const result = await User.create(userData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [userData.username, userData.email, hashedPassword, 'admin', null]
      );
      expect(result).toEqual(mockCreatedUser);
    });

    it('should default role to admin when not provided', async () => {
      // Arrange
      const userData = { username: 'test', email: 'test@example.com', password: 'Pass123!' };
      bcrypt.hash.mockResolvedValue('hashed');
      pool.query.mockResolvedValue({ rows: [{ id: 1, role: 'admin' }] });

      // Act
      await User.create(userData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['admin'])
      );
    });

    it('should use provided role when specified', async () => {
      // Arrange
      const userData = { username: 'test', email: 'test@example.com', password: 'Pass123!', role: 'super_admin' };
      bcrypt.hash.mockResolvedValue('hashed');
      pool.query.mockResolvedValue({ rows: [{ id: 1, role: 'super_admin' }] });

      // Act
      await User.create(userData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['super_admin'])
      );
    });

    it('should create department user with department field', async () => {
      // Arrange
      const userData = {
        username: 'deptuser',
        email: 'dept@example.com',
        password: 'Pass123!',
        role: 'department',
        department: 'IT Support'
      };
      const hashedPassword = 'hashed_password';
      const mockCreatedUser = {
        id: 1,
        username: userData.username,
        email: userData.email,
        role: 'department',
        department: 'IT Support'
      };

      bcrypt.hash.mockResolvedValue(hashedPassword);
      pool.query.mockResolvedValue({ rows: [mockCreatedUser] });

      // Act
      const result = await User.create(userData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [userData.username, userData.email, hashedPassword, 'department', 'IT Support']
      );
      expect(result.department).toBe('IT Support');
    });

    it('should throw error on duplicate username', async () => {
      // Arrange
      const userData = createUserData();
      const dbError = new Error('duplicate key value violates unique constraint');
      dbError.code = '23505';
      bcrypt.hash.mockResolvedValue('hashed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(User.create(userData)).rejects.toThrow('duplicate key');
    });
  });

  describe('findAll', () => {
    it('should return all users ordered by created_at DESC', async () => {
      // Arrange
      const mockUsers = [
        { id: 2, username: 'user2', email: 'user2@example.com', created_at: new Date('2024-01-02') },
        { id: 1, username: 'user1', email: 'user1@example.com', created_at: new Date('2024-01-01') }
      ];
      pool.query.mockResolvedValue({ rows: mockUsers });

      // Act
      const result = await User.findAll();

      // Assert
      expect(result).toEqual(mockUsers);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC')
      );
    });

    it('should return empty array when no users', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await User.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update username when provided', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, username: 'newusername' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      const result = await User.update(1, { username: 'newusername' });

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('username = $1'),
        expect.arrayContaining(['newusername', 1])
      );
    });

    it('should update email when provided', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, email: 'newemail@example.com' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      const result = await User.update(1, { email: 'newemail@example.com' });

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('email = $1'),
        expect.arrayContaining(['newemail@example.com', 1])
      );
    });

    it('should update role when provided', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, role: 'super_admin' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      const result = await User.update(1, { role: 'super_admin' });

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('role = $1'),
        expect.arrayContaining(['super_admin', 1])
      );
    });

    it('should update status when provided', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, status: 'inactive' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      const result = await User.update(1, { status: 'inactive' });

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['inactive', 1])
      );
    });

    it('should set deleted_at when status is deleted', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, status: 'deleted' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      await User.update(1, { status: 'deleted' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });

    it('should update department when provided', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, department: 'Finance' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      const result = await User.update(1, { department: 'Finance' });

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('department = $1'),
        expect.arrayContaining(['Finance', 1])
      );
    });

    it('should set department to null when provided', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, department: null };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      const result = await User.update(1, { department: null });

      // Assert
      expect(result).toEqual(mockUpdatedUser);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('department = $1'),
        expect.arrayContaining([null, 1])
      );
    });

    it('should only update provided fields (partial updates)', async () => {
      // Arrange
      const mockUpdatedUser = { id: 1, username: 'newusername', role: 'admin' };
      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      // Act
      await User.update(1, { username: 'newusername' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('email ='),
        expect.any(Array)
      );
    });

    it('should always set updated_at', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Act
      await User.update(1, { username: 'test' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('updatePassword', () => {
    it('should hash new password with bcrypt', async () => {
      // Arrange
      const newPassword = 'NewPass123!';
      const hashedPassword = 'new_hashed_password';
      bcrypt.hash.mockResolvedValue(hashedPassword);
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Act
      await User.updatePassword(1, newPassword);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash = $1'),
        [hashedPassword, 1]
      );
    });

    it('should update password_changed_at timestamp', async () => {
      // Arrange
      bcrypt.hash.mockResolvedValue('hashed');
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Act
      await User.updatePassword(1, 'NewPass123!');

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('password_changed_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('softDelete', () => {
    it('should set status to deleted', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Act
      await User.softDelete(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'deleted'"),
        [1]
      );
    });

    it('should set deleted_at timestamp', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Act
      await User.softDelete(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = CURRENT_TIMESTAMP'),
        [1]
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update last_login_at timestamp', async () => {
      // Arrange
      pool.query.mockResolvedValue({});

      // Act
      await User.updateLastLogin(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('last_login_at = CURRENT_TIMESTAMP'),
        [1]
      );
    });

    it('should reset login_attempts to 0', async () => {
      // Arrange
      pool.query.mockResolvedValue({});

      // Act
      await User.updateLastLogin(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('login_attempts = 0'),
        [1]
      );
    });
  });

  describe('incrementLoginAttempts', () => {
    it('should increment login_attempts by 1', async () => {
      // Arrange
      pool.query.mockResolvedValue({});

      // Act
      await User.incrementLoginAttempts('testuser');

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('login_attempts = login_attempts + 1'),
        ['testuser']
      );
    });
  });

  describe('countActiveSuperAdmins', () => {
    it('should return count of active super_admins', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '3' }] });

      // Act
      const result = await User.countActiveSuperAdmins();

      // Assert
      expect(result).toBe(3);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("role = 'super_admin' AND status = 'active'")
      );
    });

    it('should return 0 when no active super_admins', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '0' }] });

      // Act
      const result = await User.countActiveSuperAdmins();

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('findAllActive', () => {
    it('should return only non-deleted users', async () => {
      // Arrange
      const mockUsers = [
        { id: 1, username: 'user1', status: 'active' },
        { id: 2, username: 'user2', status: 'inactive' }
      ];
      pool.query.mockResolvedValue({ rows: mockUsers });

      // Act
      const result = await User.findAllActive();

      // Assert
      expect(result).toEqual(mockUsers);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status != 'deleted'")
      );
    });

    it('should order by created_at DESC', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await User.findAllActive();

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC')
      );
    });
  });

  describe('clearUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rowCount: 2 });

      // Act
      const result = await User.clearUserSessions(1);

      // Assert
      expect(result).toBe(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM session"),
        ['1']
      );
    });

    it('should return 0 when no sessions to clear', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rowCount: 0 });

      // Act
      const result = await User.clearUserSessions(1);

      // Assert
      expect(result).toBe(0);
    });
  });
});
