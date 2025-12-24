const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { validateUserCreate, validateUserUpdate, validatePasswordReset } = require('../validators/userValidators');
const { validateRequest } = require('../middleware/validation');
const UserService = require('../services/userService');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');

// GET /admin/users - List all users
router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    res.render('admin/users/index', {
      title: 'User Management',
      users,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return errorRedirect(req, res, 'Failed to load users', '/admin/dashboard');
  }
});

// GET /admin/users/new - Show create user form
router.get('/new', requireAuth, requireSuperAdmin, (req, res) => {
  res.render('admin/users/create', {
    title: 'Create User',
    user: req.session.user
  });
});

// POST /admin/users - Create new user
router.post('/',
  requireAuth,
  requireSuperAdmin,
  validateUserCreate,
  validateRequest,
  async (req, res) => {
    try {
      const { username, email, password, role } = req.body;
      await UserService.createUser({ username, email, password, role });

      return successRedirect(req, res, 'User created successfully', '/admin/users');
    } catch (error) {
      console.error('Error creating user:', error);
      return errorRedirect(req, res, error.message || 'Failed to create user', '/admin/users/new');
    }
  }
);

// GET /admin/users/:id/edit - Show edit user form
router.get('/:id/edit', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const targetUser = await UserService.getUserById(userId);

    if (!targetUser) {
      return errorRedirect(req, res, 'User not found', '/admin/users');
    }

    res.render('admin/users/edit', {
      title: 'Edit User',
      targetUser,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading user:', error);
    return errorRedirect(req, res, 'Failed to load user', '/admin/users');
  }
});

// POST /admin/users/:id - Update user
router.post('/:id',
  requireAuth,
  requireSuperAdmin,
  validateUserUpdate,
  validateRequest,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { username, email, role, status } = req.body;
      const updates = {};

      if (username) updates.username = username;
      if (email) updates.email = email;
      if (role) updates.role = role;
      if (status) updates.status = status;

      await UserService.updateUser(
        req.session.user.id,
        userId,
        updates,
        req.ip
      );

      return successRedirect(req, res, 'User updated successfully', '/admin/users');
    } catch (error) {
      console.error('Error updating user:', error);
      return errorRedirect(req, res, error.message || 'Failed to update user', `/admin/users/${req.params.id}/edit`);
    }
  }
);

// POST /admin/users/:id/delete - Delete user
router.post('/:id/delete',
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      await UserService.deleteUser(req.session.user.id, userId, req.ip);

      return successRedirect(req, res, 'User deleted successfully', '/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      return errorRedirect(req, res, error.message || 'Failed to delete user', '/admin/users');
    }
  }
);

// POST /admin/users/:id/password - Reset user password
router.post('/:id/password',
  requireAuth,
  requireSuperAdmin,
  validatePasswordReset,
  validateRequest,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;

      await UserService.resetUserPassword(req.session.user.id, userId, password, req.ip);

      return successRedirect(req, res, 'Password reset successfully', '/admin/users');
    } catch (error) {
      console.error('Error resetting password:', error);
      return errorRedirect(req, res, error.message || 'Failed to reset password', `/admin/users/${req.params.id}/edit`);
    }
  }
);

// POST /admin/users/:id/toggle-status - Toggle user status
router.post('/:id/toggle-status',
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { status } = req.body;

      await UserService.toggleUserStatus(req.session.user.id, userId, status, req.ip);

      return successRedirect(req, res, 'User status updated', '/admin/users');
    } catch (error) {
      console.error('Error toggling status:', error);
      return errorRedirect(req, res, error.message || 'Failed to update status', '/admin/users');
    }
  }
);

module.exports = router;
