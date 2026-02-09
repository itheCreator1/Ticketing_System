/**
 * Auth Middleware Unit Tests
 *
 * Tests authentication and authorization middleware:
 * - requireAuth - Validates session and user status
 * - requireAdmin - Validates admin or super_admin role
 * - requireSuperAdmin - Validates super_admin role only
 */

const { requireAuth, requireAdmin, requireSuperAdmin } = require('../../../middleware/auth');
const { createMockRequest, createMockResponse, createMockNext } = require('../../helpers/mocks');
const User = require('../../../models/User');

// Mock dependencies
jest.mock('../../../models/User');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/responseHelpers');

const { errorRedirect } = require('../../../utils/responseHelpers');

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock errorRedirect to call res.redirect
    errorRedirect.mockImplementation((req, res, message, path) => {
      res.redirect(path);
    });
  });

  describe('requireAuth', () => {
    it('should call next() when session user exists and is active', async () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'testuser', role: 'admin' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      User.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        status: 'active',
      });

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to login when no session exists', async () => {
      // Arrange
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(req, res, expect.any(String), '/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect to login when session.user is missing', async () => {
      // Arrange
      const req = createMockRequest({
        session: { someOtherData: 'value' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(req, res, expect.any(String), '/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should destroy session when user is inactive', async () => {
      // Arrange
      const destroyCallback = jest.fn((callback) => callback());
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'testuser' },
          destroy: destroyCallback,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      User.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        status: 'inactive',
      });

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(destroyCallback).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should destroy session when user is deleted', async () => {
      // Arrange
      const destroyCallback = jest.fn((callback) => callback());
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'testuser' },
          destroy: destroyCallback,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      User.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        status: 'deleted',
      });

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(destroyCallback).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should destroy session when user no longer exists', async () => {
      // Arrange
      const destroyCallback = jest.fn((callback) => callback());
      const req = createMockRequest({
        session: {
          user: { id: 999, username: 'deleteduser' },
          destroy: destroyCallback,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      User.findById.mockResolvedValue(null);

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(destroyCallback).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect to login on database error', async () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'testuser' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      User.findById.mockRejectedValue(new Error('Database error'));

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should verify user status from database not just session', async () => {
      // Arrange - session says active but DB says inactive
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'testuser', status: 'active' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      const destroyCallback = jest.fn((callback) => callback());
      req.session.destroy = destroyCallback;

      User.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        status: 'inactive',
      });

      // Act
      await requireAuth(req, res, next);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(destroyCallback).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next() when user role is admin', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'admin', role: 'admin' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(errorRedirect).not.toHaveBeenCalled();
    });

    it('should call next() when user role is super_admin', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'superadmin', role: 'super_admin' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(errorRedirect).not.toHaveBeenCalled();
    });

    it('should redirect when no session exists', () => {
      // Arrange
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireAdmin(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(req, res, expect.any(String), '/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect when user role is not admin or super_admin', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'user', role: 'user' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireAdmin(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(req, res, expect.any(String), '/admin/dashboard');
      expect(next).not.toHaveBeenCalled();
    });

    it('should set flash error message on rejection', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'user', role: 'user' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireAdmin(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(
        req,
        res,
        expect.stringContaining('permission'),
        expect.any(String)
      );
    });
  });

  describe('requireSuperAdmin', () => {
    it('should call next() only when role is super_admin', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'superadmin', role: 'super_admin' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireSuperAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(errorRedirect).not.toHaveBeenCalled();
    });

    it('should redirect when role is admin (not super_admin)', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'admin', role: 'admin' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireSuperAdmin(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(req, res, expect.any(String), '/admin/dashboard');
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect when no session exists', () => {
      // Arrange
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireSuperAdmin(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(req, res, expect.any(String), '/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should set specific error message for super_admin requirement', () => {
      // Arrange
      const req = createMockRequest({
        session: {
          user: { id: 1, username: 'admin', role: 'admin' },
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      requireSuperAdmin(req, res, next);

      // Assert
      expect(errorRedirect).toHaveBeenCalledWith(
        req,
        res,
        expect.stringContaining('Super admin'),
        expect.any(String)
      );
    });
  });
});
