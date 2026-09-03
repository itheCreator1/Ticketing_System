/**
 * Client Validators Unit Tests
 *
 * Tests client portal validation middleware for department users.
 * Validates ticket creation, status updates, and comment creation.
 * Tests field restrictions (no department/priority selection for dept users).
 */

const { validationResult } = require('express-validator');
const {
  validateClientTicketCreation,
  validateClientStatusUpdate,
  validateClientCommentCreation,
} = require('../../../validators/clientValidators');
const { createMockRequest } = require('../../helpers/mocks');
const { MAX_LENGTHS } = require('../../../constants/validation');

/**
 * Helper function to run validators and collect errors
 */
async function runValidators(validators, req) {
  for (const validator of validators) {
    await validator.run(req);
  }
  return validationResult(req);
}

describe('Client Validators', () => {
  describe('validateClientTicketCreation', () => {
    it('should pass validation for valid minimal ticket data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Ticket title',
          description: 'Ticket description',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation with phone number', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Ticket with phone',
          description: 'Description',
          reporter_phone: '+1234567890',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass validation without phone (optional)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Ticket without phone',
          description: 'Description',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should not validate department field (auto-populated)', async () => {
      // Arrange - Department field not in validator (auto-populated from user)
      const req = createMockRequest({
        body: {
          title: 'Test',
          description: 'Test',
          reporter_department: 'Emergency Department', // This field is ignored
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should not validate priority field (forced to unset)', async () => {
      // Arrange - Priority field not in validator (forced by service)
      const req = createMockRequest({
        body: {
          title: 'Test',
          description: 'Test',
          priority: 'critical', // This field is ignored
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when title is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          description: 'Description only',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'title')).toBe(true);
    });

    it('should fail when title is empty string', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: '',
          description: 'Description',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

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
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'title')).toBe(true);
    });

    it('should fail when description is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title only',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'description')).toBe(true);
    });

    it('should fail when description is empty string', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: '',
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

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
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'description')).toBe(true);
    });

    it('should fail when phone exceeds MAX_LENGTHS.PHONE_NUMBER', async () => {
      // Arrange
      const longPhone = '1'.repeat(MAX_LENGTHS.PHONE_NUMBER + 1);
      const req = createMockRequest({
        body: {
          title: 'Title',
          description: 'Description',
          reporter_phone: longPhone,
        },
      });

      // Act
      const result = await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'reporter_phone')).toBe(true);
    });

    it('should trim whitespace from title and description', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          title: '  Test Title  ',
          description: '  Test Description  ',
        },
      });

      // Act
      await runValidators(validateClientTicketCreation, req);

      // Assert
      expect(req.body.title).toBe('Test Title');
      expect(req.body.description).toBe('Test Description');
    });
  });

  describe('validateClientStatusUpdate', () => {
    it('should allow waiting_on_admin status', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'waiting_on_admin',
        },
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should allow closed status', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'closed',
        },
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should reject open status (admin-only)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'open',
        },
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(
        errors.some((e) => e.path === 'status' && e.msg.includes('waiting_on_admin, closed'))
      ).toBe(true);
    });

    it('should reject in_progress status (admin-only)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'in_progress',
        },
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'status')).toBe(true);
    });

    it('should reject waiting_on_department status (admin-only)', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'waiting_on_department',
        },
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'status')).toBe(true);
    });

    it('should fail when status is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {},
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'status' && e.msg === 'Status is required')).toBe(true);
    });

    it('should fail when status is invalid', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          status: 'invalid_status',
        },
      });

      // Act
      const result = await runValidators(validateClientStatusUpdate, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'status')).toBe(true);
    });
  });

  describe('validateClientCommentCreation', () => {
    it('should pass validation for valid comment', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          content: 'This is a valid comment',
        },
      });

      // Act
      const result = await runValidators(validateClientCommentCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should not validate visibility_type field (forced to public)', async () => {
      // Arrange - visibility_type not in validator (forced by service)
      const req = createMockRequest({
        body: {
          content: 'Comment',
          visibility_type: 'internal', // This field is ignored
        },
      });

      // Act
      const result = await runValidators(validateClientCommentCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail when content is missing', async () => {
      // Arrange
      const req = createMockRequest({
        body: {},
      });

      // Act
      const result = await runValidators(validateClientCommentCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'content' && e.msg === 'Comment cannot be empty')).toBe(
        true
      );
    });

    it('should fail when content is empty string', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          content: '',
        },
      });

      // Act
      const result = await runValidators(validateClientCommentCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'content')).toBe(true);
    });

    it('should fail when content exceeds MAX_LENGTHS.COMMENT_CONTENT', async () => {
      // Arrange
      const longContent = 'A'.repeat(MAX_LENGTHS.COMMENT_CONTENT + 1);
      const req = createMockRequest({
        body: {
          content: longContent,
        },
      });

      // Act
      const result = await runValidators(validateClientCommentCreation, req);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some((e) => e.path === 'content')).toBe(true);
    });

    it('should trim whitespace from content', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          content: '  Comment content with spaces  ',
        },
      });

      // Act
      await runValidators(validateClientCommentCreation, req);

      // Assert
      expect(req.body.content).toBe('Comment content with spaces');
    });
  });
});
