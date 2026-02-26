/**
 * Validation Middleware Unit Tests
 *
 * Tests validation middleware functions:
 * - validateRequest - Handles express-validator errors
 * - parseUserId - Parses and validates user ID from route params
 */

const { validateRequest, parseUserId } = require('../../../middleware/validation');
const {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockValidationResult,
} = require('../../helpers/mocks');

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

const { validationResult } = require('express-validator');

describe('Validation Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    it('should call next() when no validation errors exist', () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const mockResult = createMockValidationResult([]);
      validationResult.mockReturnValue(mockResult);

      // Act
      validateRequest(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should redirect with flash messages when errors exist and accepts HTML', () => {
      // Arrange
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        get: jest.fn().mockReturnValue('/admin/users/new'), // Mock Referer header
      });
      const res = createMockResponse();
      const next = createMockNext();

      const errors = [
        { msg: 'Username is required', param: 'username' },
        { msg: 'Email is invalid', param: 'email' },
      ];
      const mockResult = createMockValidationResult(errors);
      validationResult.mockReturnValue(mockResult);

      // Act
      validateRequest(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(req.accepts).toHaveBeenCalledWith('html');
      expect(req.flash).toHaveBeenCalledTimes(2);
      expect(req.flash).toHaveBeenCalledWith('error_msg', 'Username is required');
      expect(req.flash).toHaveBeenCalledWith('error_msg', 'Email is invalid');
      expect(req.get).toHaveBeenCalledWith('Referer');
      expect(res.redirect).toHaveBeenCalledWith('/admin/users/new');
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 JSON when errors exist and accepts JSON', () => {
      // Arrange
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(false),
      });
      const res = createMockResponse();
      const next = createMockNext();

      const errors = [{ msg: 'Title is required', param: 'title' }];
      const mockResult = createMockValidationResult(errors);
      validationResult.mockReturnValue(mockResult);

      // Act
      validateRequest(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(req.accepts).toHaveBeenCalledWith('html');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors });
      expect(req.flash).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle multiple validation errors correctly', () => {
      // Arrange
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        get: jest.fn().mockReturnValue(undefined), // No Referer header - should fall back to originalUrl or '/'
        originalUrl: '/admin/test?foo=bar',
      });
      const res = createMockResponse();
      const next = createMockNext();

      const errors = [
        { msg: 'Field 1 error', param: 'field1' },
        { msg: 'Field 2 error', param: 'field2' },
        { msg: 'Field 3 error', param: 'field3' },
      ];
      const mockResult = createMockValidationResult(errors);
      validationResult.mockReturnValue(mockResult);

      // Act
      validateRequest(req, res, next);

      // Assert
      expect(req.flash).toHaveBeenCalledTimes(3);
      errors.forEach((error) => {
        expect(req.flash).toHaveBeenCalledWith('error_msg', error.msg);
      });
      expect(req.get).toHaveBeenCalledWith('Referer');
      expect(res.redirect).toHaveBeenCalledWith('/admin/test');
    });

    it('should extract error messages from validation result array', () => {
      // Arrange
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(false),
      });
      const res = createMockResponse();
      const next = createMockNext();

      const errors = [{ msg: 'Invalid input', param: 'test', location: 'body' }];
      const mockResult = createMockValidationResult(errors);
      validationResult.mockReturnValue(mockResult);

      // Act
      validateRequest(req, res, next);

      // Assert
      expect(mockResult.array).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ errors });
    });
  });

  describe('parseUserId', () => {
    it('should parse valid integer ID and attach to req.userId', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '42' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBe(42);
      expect(next).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next(error) with 400 status for non-integer IDs', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'abc' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid user ID');
      expect(error.status).toBe(400);
    });

    it('should call next(error) with 400 status for negative IDs', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '-5' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid user ID');
      expect(error.status).toBe(400);
    });

    it('should call next(error) with 400 status for zero ID', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '0' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid user ID');
      expect(error.status).toBe(400);
    });

    it('should handle string IDs that parse to valid integers', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBe(123);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next(error) for decimal numbers', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '12.5' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      // parseInt('12.5') = 12, which is valid, so this should succeed
      expect(req.userId).toBe(12);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next(error) for empty string', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(400);
    });

    it('should call next(error) for special characters', () => {
      // Arrange
      const req = createMockRequest({
        params: { id: '@#$%' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      parseUserId(req, res, next);

      // Assert
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(400);
    });
  });
});
