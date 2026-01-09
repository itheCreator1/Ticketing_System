/**
 * Ticket Validators Unit Tests
 *
 * Tests the ticket validation middleware using express-validator.
 * Covers all 4 validator arrays with valid and invalid inputs.
 */

const { validationResult } = require('express-validator');
const {
  validateTicketCreation,
  validateTicketUpdate,
  validateTicketId,
  validateTicketAssignment
} = require('../../../validators/ticketValidators');
const { createMockRequest } = require('../../helpers/mocks');

// Mock Department model
jest.mock('../../../models/Department');
const Department = require('../../../models/Department');

/**
 * Helper function to run validators and collect errors
 */
async function runValidators(validators, req) {
  for (const validator of validators) {
    await validator.run(req);
  }
  return validationResult(req);
}

describe('Ticket Validators', () => {
  beforeEach(() => {
    // Mock Department.findAll to return valid departments
    Department.findAll.mockResolvedValue([
      { id: 1, name: 'IT Support' },
      { id: 2, name: 'General Support' },
      { id: 3, name: 'Human Resources' },
      { id: 4, name: 'Finance' },
      { id: 5, name: 'Facilities' }
    ]);
  });

  describe('validateTicketCreation', () => {
    it('should pass validation for valid ticket data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Valid Ticket Title',
          description: 'This is a valid ticket description with sufficient detail.',
          reporter_name: 'John Doe',
          reporter_department: 'IT Support',
          reporter_phone: '555-1234',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with minimal valid data (no name, no phone)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Ticket',
          description: 'Description',
          reporter_department: 'IT Support',
          priority: 'low'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when title is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          description: 'Description',
          reporter_department: 'IT Support',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'title')).toBe(true);
    });

    it('should fail when title is empty string', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: '   ',
          description: 'Description',
          reporter_department: 'IT Support',
          reporter_name: 'Tester',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'title')).toBe(true);
    });

    it('should fail when title exceeds maximum length', async () => {
      // Arrange
      const longTitle = 'a'.repeat(201); // MAX_LENGTHS.TICKET_TITLE is 200
      const req = createMockRequest({
        body: {
          title: longTitle,
          description: 'Description',
          reporter_department: 'IT Support',
          reporter_name: 'Tester',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'title')).toBe(true);
    });

    it('should fail when description is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          reporter_department: 'IT Support',
          reporter_name: 'Tester',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'description')).toBe(true);
    });

    it('should fail when description exceeds maximum length', async () => {
      // Arrange
      const longDescription = 'a'.repeat(5001); // MAX_LENGTHS.TICKET_DESCRIPTION is 5000
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: longDescription,
          reporter_department: 'IT Support',
          reporter_name: 'Tester',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'description')).toBe(true);
    });

    it('should pass when reporter_name is missing (optional)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'IT Support',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when reporter_name exceeds maximum length', async () => {
      // Arrange
      const longName = 'a'.repeat(101); // MAX_LENGTHS.NAME is 100
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'IT Support',
          reporter_name: longName,
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'reporter_name')).toBe(true);
    });

    it('should fail when reporter_phone exceeds maximum length', async () => {
      // Arrange
      const longPhone = '1'.repeat(21); // MAX_LENGTHS.PHONE_NUMBER is 20
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'IT Support',
          reporter_name: 'Tester',
          reporter_phone: longPhone,
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'reporter_phone')).toBe(true);
    });

    it('should fail when priority is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_department: 'IT Support',
          reporter_name: 'Tester',
          priority: 'invalid_priority'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'priority')).toBe(true);
    });

    it('should accept all valid priority values', async () => {
      const priorities = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        const req = createMockRequest({
          body: {
            title: 'Title',
            description: 'Description',
            reporter_department: 'IT Support',
              reporter_name: 'Tester',
            priority
          }
        });

        const result = await runValidators(validateTicketCreation, req);
        expect(result.isEmpty()).toBe(true);
      }
    });

    it('should trim whitespace from string fields', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: '  Ticket Title  ',
          description: '  Description  ',
          reporter_department: 'IT Support',
          reporter_name: '  John Doe  ',
          reporter_phone: '  555-1234  ',
          priority: 'medium'
        }
      });

      // Act
      const result = await runValidators(validateTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(req.body.title).toBe('Ticket Title');
      expect(req.body.description).toBe('Description');
      expect(req.body.reporter_name).toBe('John Doe');
      expect(req.body.reporter_phone).toBe('555-1234');
    });
  });

  describe('validateTicketUpdate', () => {
    it('should pass validation for valid status update', async () => {
      // Arrange
      const req = createMockRequest({
        body: { status: 'in_progress' }
      });

      // Act
      const result = await runValidators(validateTicketUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation for valid priority update', async () => {
      // Arrange
      const req = createMockRequest({
        body: { priority: 'critical' }
      });

      // Act
      const result = await runValidators(validateTicketUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation when both status and priority provided', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'closed',
          priority: 'low'
        }
      });

      // Act
      const result = await runValidators(validateTicketUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation when no fields provided (optional)', async () => {
      // Arrange
      const req = createMockRequest({ body: {} });

      // Act
      const result = await runValidators(validateTicketUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when status is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: { status: 'invalid_status' }
      });

      // Act
      const result = await runValidators(validateTicketUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'status')).toBe(true);
    });

    it('should fail when priority is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: { priority: 'invalid_priority' }
      });

      // Act
      const result = await runValidators(validateTicketUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'priority')).toBe(true);
    });

    it('should accept all valid status values', async () => {
      const statuses = ['open', 'in_progress', 'closed'];

      for (const status of statuses) {
        const req = createMockRequest({ body: { status } });
        const result = await runValidators(validateTicketUpdate, req);
        expect(result.isEmpty()).toBe(true);
      }
    });

    it('should accept all valid priority values', async () => {
      const priorities = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        const req = createMockRequest({ body: { priority } });
        const result = await runValidators(validateTicketUpdate, req);
        expect(result.isEmpty()).toBe(true);
      }
    });
  });

  describe('validateTicketId', () => {
    it('should pass validation for valid positive integer ID', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: '123' } });

      // Act
      const result = await runValidators(validateTicketId, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(req.params.id).toBe(123); // Should be converted to integer
    });

    it('should pass validation for ID = 1', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: '1' } });

      // Act
      const result = await runValidators(validateTicketId, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
      expect(req.params.id).toBe(1);
    });

    it('should fail when ID is 0', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: '0' } });

      // Act
      const result = await runValidators(validateTicketId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should fail when ID is negative', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: '-5' } });

      // Act
      const result = await runValidators(validateTicketId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should fail when ID is not a number', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: 'abc' } });

      // Act
      const result = await runValidators(validateTicketId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should fail when ID is a decimal', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: '12.5' } });

      // Act
      const result = await runValidators(validateTicketId, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should convert string ID to integer', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: '999' } });

      // Act
      await runValidators(validateTicketId, req);

      // Assert
      expect(typeof req.params.id).toBe('number');
      expect(req.params.id).toBe(999);
    });
  });

  describe('validateTicketAssignment', () => {
    it('should pass validation for valid positive integer user ID', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: '5' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation for null (unassign)', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: null } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation for empty string (unassign)', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: '' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation when assigned_to is not provided (optional)', async () => {
      // Arrange
      const req = createMockRequest({ body: {} });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when assigned_to is 0', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: '0' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'assigned_to')).toBe(true);
    });

    it('should fail when assigned_to is negative', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: '-3' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'assigned_to')).toBe(true);
    });

    it('should fail when assigned_to is not a number', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: 'invalid' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'assigned_to')).toBe(true);
    });

    it('should accept decimal strings (parseInt behavior)', async () => {
      // Arrange
      // Note: parseInt('5.5') returns 5, which is a valid positive integer
      const req = createMockRequest({ body: { assigned_to: '5.5' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      // The validator uses parseInt which truncates decimals to integers
      expect(result.isEmpty()).toBe(true);
    });

    it('should accept integer user ID = 1', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: '1' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should accept large integer user ID', async () => {
      // Arrange
      const req = createMockRequest({ body: { assigned_to: '999999' } });

      // Act
      const result = await runValidators(validateTicketAssignment, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });
  });
});
