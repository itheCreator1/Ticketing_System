/**
 * User Validators Unit Tests
 *
 * Tests the user validation middleware using express-validator.
 * Covers all 3 validator arrays with valid and invalid inputs.
 * Mocks User model for async custom validators.
 */

const { validationResult } = require('express-validator');
const {
  validateUserCreate,
  validateUserUpdate,
  validatePasswordReset
} = require('../../../validators/userValidators');
const User = require('../../../models/User');
const Department = require('../../../models/Department');
const { createMockRequest } = require('../../helpers/mocks');

// Mock User model for async validators
jest.mock('../../../models/User');
// Mock Department model for dynamic department validation
jest.mock('../../../models/Department');

/**
 * Helper function to run validators and collect errors
 */
async function runValidators(validators, req) {
  for (const validator of validators) {
    await validator.run(req);
  }
  return validationResult(req);
}

describe('User Validators', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Department.findAll() to return list of valid departments
    Department.findAll.mockResolvedValue([
      { id: 1, name: 'IT Support', active: true, is_system: false },
      { id: 2, name: 'General Support', active: true, is_system: false },
      { id: 3, name: 'Human Resources', active: true, is_system: false },
      { id: 4, name: 'Finance', active: true, is_system: false },
      { id: 5, name: 'Facilities', active: true, is_system: false }
    ]);
  });

  describe('validateUserCreate', () => {
    it('should pass validation for valid user data', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'newuser123',
          email: 'newuser@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(User.findByUsername).toHaveBeenCalledWith('newuser123');
      expect(User.findByEmail).toHaveBeenCalledWith('newuser@example.com');
    });

    it('should pass validation for super_admin role', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'superadmin',
          email: 'super@example.com',
          password: 'SuperPass123!',
          role: 'super_admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when username is too short (less than 3 chars)', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'ab',
          email: 'test@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'username')).toBe(true);
    });

    it('should fail when username exceeds 50 characters', async () => {
      // Arrange
      const longUsername = 'a'.repeat(51);
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: longUsername,
          email: 'test@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'username')).toBe(true);
    });

    it('should fail when username contains invalid characters', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'invalid-user!@#',
          email: 'test@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'username')).toBe(true);
    });

    it('should accept username with alphanumeric and underscores only', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'valid_User_123',
          email: 'test@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when username already exists', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue({ id: 1, username: 'existinguser' });
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'existinguser',
          email: 'test@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'username')).toBe(true);
      expect(User.findByUsername).toHaveBeenCalledWith('existinguser');
    });

    it('should fail when email is invalid', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'validuser',
          email: 'invalid-email',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'email')).toBe(true);
    });

    it('should fail when email already exists', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue({ id: 1, email: 'existing@example.com' });

      const req = createMockRequest({
        body: {
          username: 'newuser',
          email: 'existing@example.com',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'email')).toBe(true);
      expect(User.findByEmail).toHaveBeenCalled();
    });

    it('should normalize email addresses', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'Test.User+Tag@Example.COM',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      // Email should be normalized to lowercase
      expect(req.body.email).toBe('test.user+tag@example.com');
    });

    it('should fail when password is too short (less than 8 chars)', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Short1!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail when password lacks uppercase letter', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'lowercase123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail when password lacks lowercase letter', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'UPPERCASE123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail when password lacks number', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'NoNumbers!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail when password lacks special character', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'NoSpecial123',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail when role is invalid', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'ValidPass123!',
          role: 'invalid_role'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'role')).toBe(true);
    });

    it('should trim whitespace from username and email', async () => {
      // Arrange
      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);

      const req = createMockRequest({
        body: {
          username: '  testuser  ',
          email: '  test@example.com  ',
          password: 'ValidPass123!',
          role: 'admin'
        }
      });

      // Act
      const result = await runValidators(validateUserCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(req.body.username).toBe('testuser');
      expect(req.body.email).toBe('test@example.com');
    });

    // Department Validation Tests
    describe('department field validation', () => {
      it('should pass validation for admin role with empty department', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'adminuser',
            email: 'admin@example.com',
            password: 'ValidPass123!',
            role: 'admin',
            department: ''
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(true);
      });

      it('should pass validation for super_admin role with empty department', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'superadmin',
            email: 'super@example.com',
            password: 'ValidPass123!',
            role: 'super_admin',
            department: ''
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(true);
      });

      it('should fail validation for department role without department', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'deptuser',
            email: 'dept@example.com',
            password: 'ValidPass123!',
            role: 'department',
            department: ''
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(false);
        const errors = result.array();
        expect(errors.some(e => e.path === 'department' && e.msg.includes('required'))).toBe(true);
      });

      it('should fail validation for department role with whitespace-only department', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'deptuser',
            email: 'dept@example.com',
            password: 'ValidPass123!',
            role: 'department',
            department: '   '
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(false);
        const errors = result.array();
        expect(errors.some(e => e.path === 'department' && e.msg.includes('required'))).toBe(true);
      });

      it('should pass validation for department role with valid department', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'deptuser',
            email: 'dept@example.com',
            password: 'ValidPass123!',
            role: 'department',
            department: 'IT Support'
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(true);
      });

      it('should pass validation for department role with all valid departments', async () => {
        const validDepartments = [
          'IT Support',
          'General Support',
          'Human Resources',
          'Finance',
          'Facilities'
        ];

        for (const department of validDepartments) {
          User.findByUsername.mockResolvedValue(null);
          User.findByEmail.mockResolvedValue(null);

          const req = createMockRequest({
            body: {
              username: 'deptuser',
              email: 'dept@example.com',
              password: 'ValidPass123!',
              role: 'department',
              department
            }
          });

          const result = await runValidators(validateUserCreate, req);
          expect(result.isEmpty()).toBe(true);
        }
      });

      it('should fail validation for department role with invalid department', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'deptuser',
            email: 'dept@example.com',
            password: 'ValidPass123!',
            role: 'department',
            department: 'Invalid Department'
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(false);
        const errors = result.array();
        expect(errors.some(e => e.path === 'department' && e.msg.includes('Invalid'))).toBe(true);
      });

      it('should fail validation for admin role with department set', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'adminuser',
            email: 'admin@example.com',
            password: 'ValidPass123!',
            role: 'admin',
            department: 'IT Support'
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(false);
        const errors = result.array();
        expect(errors.some(e => e.path === 'department' && e.msg.includes('only'))).toBe(true);
      });

      it('should fail validation for super_admin role with department set', async () => {
        // Arrange
        User.findByUsername.mockResolvedValue(null);
        User.findByEmail.mockResolvedValue(null);

        const req = createMockRequest({
          body: {
            username: 'superadmin',
            email: 'super@example.com',
            password: 'ValidPass123!',
            role: 'super_admin',
            department: 'Finance'
          }
        });

        // Act
        const result = await runValidators(validateUserCreate, req);

        // Assert
        expect(result.isEmpty()).toBe(false);
        const errors = result.array();
        expect(errors.some(e => e.path === 'department' && e.msg.includes('only'))).toBe(true);
      });
    });
  });

  describe('validateUserUpdate', () => {
    it('should pass validation for valid username update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { username: 'newusername' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation for valid email update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '10' },
        body: { email: 'newemail@example.com' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation for valid role update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '3' },
        body: { role: 'super_admin' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation for valid status update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '7' },
        body: { status: 'inactive' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation when updating multiple fields', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '8' },
        body: {
          username: 'updateduser',
          email: 'updated@example.com',
          role: 'admin',
          status: 'active'
        }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation when no fields provided (optional updates)', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '12' },
        body: {}
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when user ID param is not an integer', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'invalid' },
        body: { username: 'newusername' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should fail when username is too short', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { username: 'ab' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'username')).toBe(true);
    });

    it('should fail when username contains invalid characters', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { username: 'invalid@user!' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'username')).toBe(true);
    });

    it('should fail when email is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { email: 'not-an-email' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'email')).toBe(true);
    });

    it('should fail when role is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { role: 'invalid_role' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'role')).toBe(true);
    });

    it('should fail when status is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { status: 'invalid_status' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'status')).toBe(true);
    });

    it('should accept both valid status values (active and inactive)', async () => {
      // Test active
      let req = createMockRequest({
        params: { id: '5' },
        body: { status: 'active' }
      });
      let result = await runValidators(validateUserUpdate, req);
      expect(result.isEmpty()).toBe(true);

      // Test inactive
      req = createMockRequest({
        params: { id: '6' },
        body: { status: 'inactive' }
      });
      result = await runValidators(validateUserUpdate, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should normalize email when provided', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { email: 'Test.Email@Example.COM' }
      });

      // Act
      const result = await runValidators(validateUserUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(req.body.email).toBe('test.email@example.com');
    });
  });

  describe('validatePasswordReset', () => {
    it('should pass validation for valid password reset', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { password: 'NewValidPass123!' }
      });

      // Act
      const result = await runValidators(validatePasswordReset, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when user ID param is not an integer', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'notanumber' },
        body: { password: 'NewValidPass123!' }
      });

      // Act
      const result = await runValidators(validatePasswordReset, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should fail when password is too short', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { password: 'Short1!' }
      });

      // Act
      const result = await runValidators(validatePasswordReset, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail when password lacks complexity requirements', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: { password: 'nocomplexity' }
      });

      // Act
      const result = await runValidators(validatePasswordReset, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should accept strong passwords with all requirements', async () => {
      const strongPasswords = [
        'StrongPass123!',
        'Complex@Password1',
        'Secure#123Pass',
        'Valid$Password9'
      ];

      for (const password of strongPasswords) {
        const req = createMockRequest({
          params: { id: '5' },
          body: { password }
        });
        const result = await runValidators(validatePasswordReset, req);
        expect(result.isEmpty()).toBe(true);
      }
    });
  });
});
