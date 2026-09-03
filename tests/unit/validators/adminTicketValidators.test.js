/**
 * Admin Ticket Validators Unit Tests
 *
 * Tests admin ticket validation middleware.
 * Covers both admin ticket creation (all depts) and department ticket creation (excludes Internal).
 * Mocks Department model for async custom validators.
 */

const { validationResult } = require('express-validator');
const {
  validateAdminTicketCreation,
  validateDepartmentTicketCreation,
} = require('../../../validators/adminTicketValidators');
const Department = require('../../../models/Department');
const { createMockRequest } = require('../../helpers/mocks');
const { MAX_LENGTHS } = require('../../../constants/validation');

// Mock Department model
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

describe('Admin Ticket Validators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAdminTicketCreation', () => {
    beforeEach(() => {
      // Mock all departments INCLUDING 'Internal' (system dept)
      Department.findAll.mockResolvedValue([
        { id: 1, name: 'Emergency Department', is_system: false },
        { id: 2, name: 'Cardiology', is_system: false },
        { id: 3, name: 'Internal', is_system: true },
      ]);
    });

    it('should pass validation for valid admin ticket data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Internal system ticket',
          description: 'Admin-only ticket description',
          reporter_department: 'Internal',
          priority: 'medium',
          status: 'open',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(Department.findAll).toHaveBeenCalledWith(true); // includeSystem=true
    });

    it('should allow Internal department (system dept)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Test',
          description: 'Test',
          reporter_department: 'Internal',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation without priority (optional)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Test Ticket',
          description: 'Description',
          reporter_department: 'Emergency Department',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation without status (optional)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Test Ticket',
          description: 'Description',
          reporter_department: 'Cardiology',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when title is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          description: 'Description',
          reporter_department: 'Internal',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'title')).toBe(true);
    });

    it('should fail when title exceeds MAX_LENGTHS.TICKET_TITLE', async () => {
      // Arrange
      const longTitle = 'A'.repeat(MAX_LENGTHS.TICKET_TITLE + 1);
      const req = createMockRequest({
        body: {
          title: longTitle,
          description: 'Description',
          reporter_department: 'Internal',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'title')).toBe(true);
    });

    it('should fail when description is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          reporter_department: 'Internal',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'description')).toBe(true);
    });

    it('should fail when description exceeds MAX_LENGTHS.TICKET_DESCRIPTION', async () => {
      // Arrange
      const longDesc = 'A'.repeat(MAX_LENGTHS.TICKET_DESCRIPTION + 1);
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: longDesc,
          reporter_department: 'Internal',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'description')).toBe(true);
    });

    it('should fail when reporter_department is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'reporter_department')).toBe(true);
    });

    it('should fail when reporter_department is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'NonExistent Department',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'reporter_department')).toBe(true);
    });

    it('should fail when priority is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'Internal',
          priority: 'urgent', // Invalid priority
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'priority')).toBe(true);
    });

    it('should fail when status is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'Internal',
          status: 'invalid_status',
        },
      });

      // Act
      const result = await runValidators(validateAdminTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'status')).toBe(true);
    });
  });

  describe('validateDepartmentTicketCreation', () => {
    beforeEach(() => {
      // Mock all departments EXCLUDING 'Internal' (system dept)
      Department.findAll.mockResolvedValue([
        { id: 1, name: 'Emergency Department', is_system: false },
        { id: 2, name: 'Cardiology', is_system: false },
        { id: 3, name: 'Radiology', is_system: false },
      ]);
    });

    it('should pass validation for valid department ticket data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Department ticket',
          description: 'Ticket on behalf of department',
          reporter_name: 'Dr. Smith',
          reporter_department: 'Emergency Department',
          priority: 'high',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(Department.findAll).toHaveBeenCalledWith(false); // includeSystem=false
    });

    it('should reject Internal department', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Test',
          description: 'Test',
          reporter_name: 'Admin',
          reporter_department: 'Internal', // System dept not allowed
        },
      });

      // Act
      const result = await runValidators(validateDepartmentTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(
        errors.some(
          (e) =>
            e.path === 'reporter_department' &&
            e.msg.includes('Cannot create department tickets for Internal')
        )
      ).toBe(true);
    });

    it('should fail when reporter_name is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'Cardiology',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'reporter_name')).toBe(true);
    });

    it('should fail when reporter_name exceeds MAX_LENGTHS.NAME', async () => {
      // Arrange
      const longName = 'A'.repeat(MAX_LENGTHS.NAME + 1);
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_name: longName,
          reporter_department: 'Radiology',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'reporter_name')).toBe(true);
    });

    it('should pass validation without priority (optional)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Test',
          description: 'Test',
          reporter_name: 'Contact',
          reporter_department: 'Cardiology',
        },
      });

      // Act
      const result = await runValidators(validateDepartmentTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should not have status field (always open)', async () => {
      // Arrange - Status field should be ignored/not validated
      const req = createMockRequest({
        body: {
          title: 'Test',
          description: 'Test',
          reporter_name: 'Contact',
          reporter_department: 'Emergency Department',
          status: 'closed', // This field is not validated (will be ignored by service)
        },
      });

      // Act
      const result = await runValidators(validateDepartmentTicketCreation, req);

      // Assert
      // Validation should pass - status field is simply not validated
      expect(result.isEmpty()).toBe(true);
    });
  });
});
