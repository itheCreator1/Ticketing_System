const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { validateUserCreate, validateUserUpdate, validatePasswordReset } = require('../validators/userValidators');
const { validateRequest } = require('../middleware/validation');
const userService = require('../services/userService');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');
const { loginLimiter } = require('../middleware/rateLimiter');
const { REPORTER_DEPARTMENT } = require('../constants/enums');
const logger = require('../utils/logger');

// GET /admin/users - List all users
router.get('/', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.render('admin/users/index', {
      title: 'User Management',
      users,
      user: req.session.user
    });
  } catch (error) {
    logger.error('Error fetching users', { error: error.message, stack: error.stack });
    next(error);
  }
});

// GET /admin/users/new - Show create user form
router.get('/new', requireAuth, requireSuperAdmin, (req, res) => {
  res.render('admin/users/create', {
    title: 'Create User',
    user: req.session.user,
    REPORTER_DEPARTMENT
  });
});

// POST /admin/users - Create new user
router.post('/',
  requireAuth,
  requireSuperAdmin,
  validateUserCreate,
  validateRequest,
  async (req, res, next) => {
    try {
      const { username, email, password, role, department } = req.body;
      await userService.createUser({ username, email, password, role, department });

      return successRedirect(req, res, 'User created successfully', '/admin/users');
    } catch (error) {
      logger.error('Error creating user', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

// GET /admin/users/:id/edit - Show edit user form
router.get('/:id/edit', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const targetUser = await userService.getUserById(userId);

    if (!targetUser) {
      const error = new Error('User not found');
      error.status = 404;
      return next(error);
    }

    res.render('admin/users/edit', {
      title: 'Edit User',
      targetUser,
      user: req.session.user,
      REPORTER_DEPARTMENT
    });
  } catch (error) {
    logger.error('Error loading user', { error: error.message, stack: error.stack });
    next(error);
  }
});

// POST /admin/users/:id - Update user
router.post('/:id',
  requireAuth,
  requireSuperAdmin,
  validateUserUpdate,
  validateRequest,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const { username, email, role, status, department } = req.body;
      const updates = {};

      if (username) updates.username = username;
      if (email) updates.email = email;
      if (role) updates.role = role;
      if (status) updates.status = status;
      if (department !== undefined) updates.department = department || null;

      await userService.updateUser(
        req.session.user.id,
        userId,
        updates,
        req.ip
      );

      return successRedirect(req, res, 'User updated successfully', '/admin/users');
    } catch (error) {
      logger.error('Error updating user', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

// POST /admin/users/:id/delete - Delete user
router.post('/:id/delete',
  requireAuth,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      await userService.deleteUser(req.session.user.id, userId, req.ip);

      return successRedirect(req, res, 'User deleted successfully', '/admin/users');
    } catch (error) {
      logger.error('Error deleting user', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

// POST /admin/users/:id/password - Reset user password
router.post('/:id/password',
  requireAuth,
  requireSuperAdmin,
  validatePasswordReset,
  validateRequest,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;

      await userService.resetUserPassword(req.session.user.id, userId, password, req.ip);

      return successRedirect(req, res, 'Password reset successfully', '/admin/users');
    } catch (error) {
      logger.error('Error resetting password', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

// POST /admin/users/:id/toggle-status - Toggle user status
router.post('/:id/toggle-status',
  requireAuth,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const { status } = req.body;

      await userService.toggleUserStatus(req.session.user.id, userId, status, req.ip);

      return successRedirect(req, res, 'User status updated', '/admin/users');
    } catch (error) {
      logger.error('Error toggling status', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

module.exports = router;
