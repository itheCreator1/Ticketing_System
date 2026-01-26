const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { validateDepartmentCreate, validateDepartmentUpdate, validateDepartmentId, validateUserAssignment } = require('../validators/departmentValidators');
const { validateRequest } = require('../middleware/validation');
const departmentService = require('../services/departmentService');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

// All routes require super admin
router.use(requireAuth, requireSuperAdmin);

/**
 * GET /admin/departments - List all departments
 */
router.get('/', async (req, res, next) => {
  try {
    const departments = await departmentService.getAllDepartments();
    res.render('admin/departments/index', {
      title: 'Manage Departments',
      departments
    });
  } catch (error) {
    logger.error('Error loading departments', { error: error.message });
    next(error);
  }
});

/**
 * GET /admin/departments/new - New department form
 */
router.get('/new', (req, res) => {
  res.render('admin/departments/create', {
    title: 'Create Department'
  });
});

/**
 * POST /admin/departments - Create department
 */
router.post('/', validateDepartmentCreate, validateRequest, async (req, res, next) => {
  try {
    const department = await departmentService.createDepartment(
      req.session.user.id,
      { name: req.body.name, description: req.body.description, floor: req.body.floor },
      req.ip
    );

    logger.info('Department created', {
      departmentId: department.id,
      name: department.name,
      createdBy: req.session.user.username
    });

    successRedirect(req, res, 'Department created successfully', '/admin/departments');
  } catch (error) {
    logger.error('Error creating department', { error: error.message });
    next(error);
  }
});

/**
 * GET /admin/departments/:id/edit - Edit department form
 */
router.get('/:id/edit', validateDepartmentId, validateRequest, async (req, res, next) => {
  try {
    const departmentId = parseInt(req.params.id);
    const department = await departmentService.getDepartmentById(departmentId);

    if (department.is_system) {
      req.flash('error_msg', 'System departments cannot be edited');
      return res.redirect('/admin/departments');
    }

    // Get users assigned to department
    const users = await departmentService.getDepartmentUsers(departmentId);
    const availableUsers = await departmentService.getAvailableUsers(departmentId);

    // Get active ticket counts for each assigned user
    const User = require('../models/User');
    for (let user of users) {
      user.active_tickets = await User.countActiveTickets(user.id);
    }

    res.render('admin/departments/edit', {
      title: 'Edit Department',
      department,
      users,
      availableUsers
    });
  } catch (error) {
    logger.error('Error loading department', { error: error.message });
    next(error);
  }
});

/**
 * POST /admin/departments/:id - Update department
 */
router.post('/:id', validateDepartmentUpdate, validateRequest, async (req, res, next) => {
  try {
    await departmentService.updateDepartment(
      req.session.user.id,
      parseInt(req.params.id),
      { name: req.body.name, description: req.body.description, floor: req.body.floor, active: req.body.active },
      req.ip
    );

    successRedirect(req, res, 'Department updated successfully', '/admin/departments');
  } catch (error) {
    logger.error('Error updating department', { error: error.message });
    next(error);
  }
});

/**
 * POST /admin/departments/:id/deactivate - Deactivate department
 */
router.post('/:id/deactivate', validateDepartmentId, validateRequest, async (req, res, next) => {
  try {
    await departmentService.deactivateDepartment(
      req.session.user.id,
      parseInt(req.params.id),
      req.ip
    );

    successRedirect(req, res, 'Department deactivated successfully', '/admin/departments');
  } catch (error) {
    logger.error('Error deactivating department', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /admin/departments/:id/reactivate - Reactivate department
 */
router.post('/:id/reactivate', validateDepartmentId, validateRequest, async (req, res, next) => {
  try {
    await departmentService.reactivateDepartment(
      req.session.user.id,
      parseInt(req.params.id),
      req.ip
    );

    successRedirect(req, res, 'Department reactivated successfully', '/admin/departments');
  } catch (error) {
    logger.error('Error reactivating department', { error: error.message });
    next(error);
  }
});

/**
 * POST /admin/departments/:id/users/add - Assign user to department
 */
router.post('/:id/users/add', validateDepartmentId, validateUserAssignment, validateRequest, async (req, res, next) => {
  try {
    const departmentId = parseInt(req.params.id);
    const userId = parseInt(req.body.user_id);

    await departmentService.assignUserToDepartment(req.session.user.id, departmentId, userId, req.ip);

    logger.info('User assigned to department', {
      departmentId,
      userId,
      assignedBy: req.session.user.username
    });

    successRedirect(req, res, 'User assigned to department successfully', `/admin/departments/${departmentId}/edit`);
  } catch (error) {
    logger.error('Error assigning user', { departmentId: req.params.id, userId: req.body.user_id, error: error.message });
    next(error);
  }
});

/**
 * POST /admin/departments/:id/users/:userId/remove - Remove user from department
 */
router.post('/:id/users/:userId/remove', validateDepartmentId, validateRequest, async (req, res, next) => {
  try {
    const departmentId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    await departmentService.removeUserFromDepartment(req.session.user.id, departmentId, userId, req.ip);

    logger.info('User removed from department', {
      departmentId,
      userId,
      removedBy: req.session.user.username
    });

    successRedirect(req, res, 'User removed from department successfully', `/admin/departments/${departmentId}/edit`);
  } catch (error) {
    logger.error('Error removing user', { departmentId: req.params.id, userId: req.params.userId, error: error.message });
    next(error);
  }
});

module.exports = router;
