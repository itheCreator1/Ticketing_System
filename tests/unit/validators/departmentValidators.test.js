/**
 * Department Validators Unit Tests
 *
 * Tests the department validation middleware using express-validator.
 * Covers all 4 validator arrays with valid and invalid inputs.
 */

const { validationResult } = require('express-validator');
const {
  validateDepartmentCreate,
  validateDepartmentUpdate,
  validateDepartmentId,
  validateUserAssignment,
} = require('../../../validators/departmentValidators');
const { createMockRequest } = require('../../helpers/mocks');
const { MAX_LENGTHS } = require('../../../constants/validation');
const Floor = require('../../../models/Floor');

jest.mock('../../../models/Floor');

/**
 * Helper function to run validators and collect errors
 */
async function runValidators(validators, req) {
  for (const validator of validators) {
    await validator.run(req);
  }
  return validationResult(req);
}

describe('Department Validators', () => {
  beforeEach(() => {
    Floor.findAll.mockResolvedValue([{ id: 1, name: 'Ground Floor' }]);
  });

  describe('validateDepartmentCreate', () => {
    it('should pass validation for valid department data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: 'Emergency Department',
          description: 'Emergency and urgent care services',
          floor: 'Ground Floor',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with minimum name length (2 chars)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: 'ED', // 2 characters
          description: 'Emergency Department',
          floor: 'Ground Floor',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation without description (optional)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: 'Cardiology',
          floor: 'Ground Floor',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with empty description (nullable)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: 'Radiology',
          description: '',
          floor: 'Ground Floor',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should trim whitespace from name', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: '  Surgery  ',
          description: 'Surgical services',
        },
      });

      // Act
      await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(req.body.name).toBe('Surgery');
    });

    it('should trim whitespace from description', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: 'Pharmacy',
          description: '  Medication management  ',
        },
      });

      // Act
      await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(req.body.description).toBe('Medication management');
    });

    it('should fail when name is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          description: 'Test description',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'name' && e.msg === 'Department name is required')).toBe(
        true
      );
    });

    it('should fail when name is empty string', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: '',
          description: 'Test',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'name')).toBe(true);
    });

    it('should fail when name is too short (< 2 chars)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          name: 'A', // Only 1 character
          description: 'Test',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'name' && e.msg.includes('2-'))).toBe(true);
    });

    it('should fail when name exceeds MAX_LENGTHS.DEPARTMENT', async () => {
      // Arrange
      const longName = 'A'.repeat(MAX_LENGTHS.DEPARTMENT + 1);
      const req = createMockRequest({
        body: {
          name: longName,
          description: 'Test',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'name')).toBe(true);
    });

    it('should fail when description exceeds 500 characters', async () => {
      // Arrange
      const longDescription = 'A'.repeat(501);
      const req = createMockRequest({
        body: {
          name: 'Test Department',
          description: longDescription,
        },
      });

      // Act
      const result = await runValidators(validateDepartmentCreate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'description' && e.msg.includes('500'))).toBe(true);
    });
  });

  describe('validateDepartmentUpdate', () => {
    it('should pass validation for valid update data', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '1' },
        body: {
          name: 'Updated Department',
          description: 'Updated description',
          active: true,
        },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with only name update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '5' },
        body: {
          name: 'New Name Only',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with only description update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '3' },
        body: {
          description: 'New description only',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with only active status update', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '2' },
        body: {
          active: false,
        },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with empty body (all fields optional)', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '1' },
        body: {},
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when ID is invalid (not a number)', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'abc' },
        body: { name: 'Test' },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'id' && e.msg === 'Invalid department ID')).toBe(true);
    });

    it('should fail when ID is zero', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '0' },
        body: { name: 'Test' },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'id')).toBe(true);
    });

    it('should fail when ID is negative', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '-5' },
        body: { name: 'Test' },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'id')).toBe(true);
    });

    it('should fail when name is too short', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '1' },
        body: { name: 'A' }, // 1 character
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'name')).toBe(true);
    });

    it('should fail when name is too long', async () => {
      // Arrange
      const longName = 'A'.repeat(MAX_LENGTHS.DEPARTMENT + 1);
      const req = createMockRequest({
        params: { id: '1' },
        body: { name: longName },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'name')).toBe(true);
    });

    it('should fail when description exceeds 500 characters', async () => {
      // Arrange
      const longDescription = 'A'.repeat(501);
      const req = createMockRequest({
        params: { id: '1' },
        body: { description: longDescription },
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'description')).toBe(true);
    });

    it('should fail when active is not boolean', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '1' },
        body: { active: 'yes' }, // String instead of boolean
      });

      // Act
      const result = await runValidators(validateDepartmentUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'active' && e.msg === 'Active must be boolean')).toBe(
        true
      );
    });
  });

  describe('validateDepartmentId', () => {
    it('should pass validation for valid positive integer ID', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '42' },
      });

      // Act
      const result = await runValidators(validateDepartmentId, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when ID is not a number', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'notanumber' },
      });

      // Act
      const result = await runValidators(validateDepartmentId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'id' && e.msg === 'Invalid department ID')).toBe(true);
    });

    it('should fail when ID is zero', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '0' },
      });

      // Act
      const result = await runValidators(validateDepartmentId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'id')).toBe(true);
    });

    it('should fail when ID is negative', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '-10' },
      });

      // Act
      const result = await runValidators(validateDepartmentId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'id')).toBe(true);
    });
  });

  describe('validateUserAssignment', () => {
    it('should pass validation for valid user_id', async () => {
      // Arrange
      const req = createMockRequest({
        body: { user_id: '25' },
      });

      // Act
      const result = await runValidators(validateUserAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should convert user_id to integer', async () => {
      // Arrange
      const req = createMockRequest({
        body: { user_id: '10' },
      });

      // Act
      await runValidators(validateUserAssignment, req);

      // Assert
      expect(req.body.user_id).toBe(10); // Converted to number
      expect(typeof req.body.user_id).toBe('number');
    });

    it('should fail when user_id is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {},
      });

      // Act
      const result = await runValidators(validateUserAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'user_id' && e.msg === 'User is required')).toBe(true);
    });

    it('should fail when user_id is empty string', async () => {
      // Arrange
      const req = createMockRequest({
        body: { user_id: '' },
      });

      // Act
      const result = await runValidators(validateUserAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'user_id')).toBe(true);
    });

    it('should fail when user_id is not a number', async () => {
      // Arrange
      const req = createMockRequest({
        body: { user_id: 'abc' },
      });

      // Act
      const result = await runValidators(validateUserAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'user_id' && e.msg === 'Invalid user ID')).toBe(true);
    });

    it('should fail when user_id is zero', async () => {
      // Arrange
      const req = createMockRequest({
        body: { user_id: '0' },
      });

      // Act
      const result = await runValidators(validateUserAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'user_id')).toBe(true);
    });

    it('should fail when user_id is negative', async () => {
      // Arrange
      const req = createMockRequest({
        body: { user_id: '-5' },
      });

      // Act
      const result = await runValidators(validateUserAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'user_id')).toBe(true);
    });
  });
});
