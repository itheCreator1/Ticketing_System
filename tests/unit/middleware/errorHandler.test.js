/**
 * Error Handler Middleware Unit Tests
 *
 * Tests the global error handler middleware:
 * - Renders appropriate error templates based on status code
 * - Hides error details in production
 * - Shows error details in development
 * - Returns JSON for API requests
 * - Logs errors using Winston
 */

const errorHandler = require('../../../middleware/errorHandler');
const { createMockRequest, createMockResponse, createMockNext } = require('../../helpers/mocks');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('Error Handler Middleware', () => {
  let originalNodeEnv;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  describe('errorHandler', () => {
    it('should render 404 template for 404 status', () => {
      // Arrange
      const error = new Error('Not Found');
      error.status = 404;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/not-found',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.render).toHaveBeenCalledWith('errors/404', expect.objectContaining({
        title: 'Error',
        status: 404,
        message: 'Not Found',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'NOT_FOUND',
        isDevelopment: true,
        stackTrace: expect.any(String)
      }));
      expect(logger.error).toHaveBeenCalledWith(
        'Error handler caught exception',
        expect.objectContaining({
          error: 'Not Found',
          status: 404,
          url: '/not-found',
          method: 'GET'
        })
      );
    });

    it('should render 403 template for 403 status', () => {
      // Arrange
      const error = new Error('Forbidden');
      error.status = 403;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/forbidden',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.render).toHaveBeenCalledWith('errors/403', expect.objectContaining({
        title: 'Error',
        status: 403,
        message: 'Forbidden',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'FORBIDDEN',
        isDevelopment: true,
        stackTrace: expect.any(String)
      }));
    });

    it('should render 500 template for 500 status', () => {
      // Arrange
      const error = new Error('Internal Server Error');
      error.status = 500;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/error',
        method: 'POST'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith('errors/500', expect.objectContaining({
        title: 'Error',
        status: 500,
        message: 'Internal Server Error',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'SERVER_ERROR',
        isDevelopment: true,
        stackTrace: expect.any(String)
      }));
    });

    it('should render generic error template for other status codes', () => {
      // Arrange
      const error = new Error('Bad Request');
      error.status = 400;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/bad',
        method: 'POST'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('errors/error', expect.objectContaining({
        title: 'Error',
        status: 400,
        message: 'Bad Request',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'CLIENT_ERROR',
        isDevelopment: true,
        stackTrace: expect.any(String)
      }));
    });

    it('should hide error details in production mode for 500 errors', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive database error details');
      error.status = 500;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/error',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.render).toHaveBeenCalledWith('errors/500', expect.objectContaining({
        title: 'Error',
        status: 500,
        message: 'Internal server error',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'SERVER_ERROR',
        isDevelopment: false,
        stackTrace: null
      }));
    });

    it('should hide error details in production mode for non-500 errors', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const error = new Error('Detailed error message');
      error.status = 400;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/error',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.render).toHaveBeenCalledWith('errors/error', expect.objectContaining({
        title: 'Error',
        status: 400,
        message: 'An error occurred',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'CLIENT_ERROR',
        isDevelopment: false,
        stackTrace: null
      }));
    });

    it('should show error details in development mode', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const error = new Error('Detailed development error');
      error.status = 500;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/error',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.render).toHaveBeenCalledWith('errors/500', expect.objectContaining({
        title: 'Error',
        status: 500,
        message: 'Detailed development error',
        user: null,
        correlationId: expect.any(String),
        errorCategory: 'SERVER_ERROR',
        isDevelopment: true,
        stackTrace: expect.any(String)
      }));
    });

    it('should return JSON response when client accepts application/json', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const error = new Error('API error');
      error.status = 400;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(false),
        url: '/api/endpoint',
        method: 'POST'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(req.accepts).toHaveBeenCalledWith('html');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'API error',
          correlationId: expect.any(String),
          category: 'CLIENT_ERROR'
        }
      });
      expect(res.render).not.toHaveBeenCalled();
    });

    it('should return generic JSON message in production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive error details');
      error.status = 500;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(false),
        url: '/api/endpoint',
        method: 'POST'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          correlationId: expect.any(String),
          category: 'SERVER_ERROR'
        }
      });
    });

    it('should log error details using logger', () => {
      // Arrange
      const error = new Error('Test error');
      error.status = 400;
      error.stack = 'Error stack trace...';
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/test',
        method: 'POST'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error handler caught exception',
        expect.objectContaining({
          correlationId: expect.any(String),
          errorCategory: 'CLIENT_ERROR',
          error: 'Test error',
          stack: 'Error stack trace...',
          status: 400,
          url: '/test',
          method: 'POST',
          userId: 'anonymous',
          userRole: 'none',
          timestamp: expect.any(String),
          requestStartTime: null,
          headers: expect.any(Object),
          ip: '127.0.0.1',
          userAgent: undefined
        })
      );
    });

    it('should default to 500 status when err.status is undefined', () => {
      // Arrange
      const error = new Error('No status error');
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/test',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith('errors/500', expect.objectContaining({
        status: 500
      }));
    });

    it('should use default message when err.message is undefined', () => {
      // Arrange
      const error = new Error();
      error.message = '';
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/test',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.render).toHaveBeenCalledWith('errors/500', expect.objectContaining({
        message: 'Something went wrong'
      }));
    });

    it('should include user from res.locals if available', () => {
      // Arrange
      const error = new Error('Test error');
      error.status = 404;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/test',
        method: 'GET'
      });
      const res = createMockResponse();
      res.locals.user = { id: 1, username: 'testuser', role: 'admin' };
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(res.render).toHaveBeenCalledWith('errors/404', expect.objectContaining({
        user: { id: 1, username: 'testuser', role: 'admin' }
      }));
    });

    it('should log stack trace from error object', () => {
      // Arrange
      const error = new Error('Stack test');
      error.status = 500;
      const req = createMockRequest({
        accepts: jest.fn().mockReturnValue(true),
        url: '/test',
        method: 'GET'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      errorHandler(error, req, res, next);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error handler caught exception',
        expect.objectContaining({
          stack: expect.any(String)
        })
      );
    });
  });
});
