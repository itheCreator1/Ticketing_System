const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { validateFloorId, validateFloorCreate, validateFloorUpdate } = require('../validators/floorValidators');
const { validateRequest } = require('../middleware/validation');
const floorService = require('../services/floorService');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');
const logger = require('../utils/logger');
const Floor = require('../models/Floor');

// All routes require super admin
router.use(requireAuth, requireSuperAdmin);

/**
 * GET /admin/floors - List all floors
 */
router.get('/', async (req, res, next) => {
  try {
    const floors = await floorService.getAllFloors();

    logger.info('Viewed floor list', {
      userId: req.session.user.id,
      username: req.session.user.username
    });

    res.render('admin/floors/index', {
      title: 'Manage Floors',
      floors
    });
  } catch (error) {
    logger.error('Error loading floors', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /admin/floors/new - New floor form
 */
router.get('/new', (req, res) => {
  res.render('admin/floors/create', {
    title: 'Create Floor'
  });
});

/**
 * POST /admin/floors - Create floor
 */
router.post('/', validateFloorCreate, validateRequest, async (req, res, next) => {
  try {
    const floor = await floorService.createFloor(
      req.session.user.id,
      { name: req.body.name, sort_order: req.body.sort_order },
      req.ip
    );

    logger.info('Floor created', {
      floorId: floor.id,
      name: floor.name,
      createdBy: req.session.user.username
    });

    successRedirect(req, res, 'Floor created successfully', '/admin/floors');
  } catch (error) {
    logger.error('Error creating floor', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /admin/floors/:id/edit - Edit floor form
 */
router.get('/:id/edit', validateFloorId, validateRequest, async (req, res, next) => {
  try {
    const floorId = parseInt(req.params.id);
    const floor = await floorService.getFloorById(floorId);

    if (floor.is_system) {
      req.flash('error_msg', 'System floors cannot be edited');
      return res.redirect('/admin/floors');
    }

    // Get department count for this floor
    const departmentCount = await Floor.countDepartments(floor.name);

    res.render('admin/floors/edit', {
      title: 'Edit Floor',
      floor,
      departmentCount
    });
  } catch (error) {
    logger.error('Error loading floor', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /admin/floors/:id - Update floor
 */
router.post('/:id', validateFloorUpdate, validateRequest, async (req, res, next) => {
  try {
    const floorId = parseInt(req.params.id);

    await floorService.updateFloor(
      req.session.user.id,
      floorId,
      { name: req.body.name, sort_order: req.body.sort_order, active: req.body.active },
      req.ip
    );

    logger.info('Floor updated', {
      floorId,
      updatedBy: req.session.user.username
    });

    successRedirect(req, res, 'Floor updated successfully', '/admin/floors');
  } catch (error) {
    logger.error('Error updating floor', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /admin/floors/:id/deactivate - Deactivate floor (soft delete)
 */
router.post('/:id/deactivate', validateFloorId, validateRequest, async (req, res, next) => {
  try {
    const floorId = parseInt(req.params.id);
    const floor = await floorService.getFloorById(floorId);

    if (floor.is_system) {
      errorRedirect(req, res, 'System floors cannot be deactivated', '/admin/floors');
      return;
    }

    // Get department count
    const departmentCount = await Floor.countDepartments(floor.name);
    if (departmentCount > 0) {
      errorRedirect(req, res, `Cannot deactivate floor with ${departmentCount} department(s). Please reassign first.`, '/admin/floors');
      return;
    }

    await floorService.deactivateFloor(req.session.user.id, floorId, req.ip);

    logger.info('Floor deactivated', {
      floorId,
      deactivatedBy: req.session.user.username
    });

    successRedirect(req, res, 'Floor deactivated successfully', '/admin/floors');
  } catch (error) {
    logger.error('Error deactivating floor', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /admin/floors/:id/reactivate - Reactivate floor
 */
router.post('/:id/reactivate', validateFloorId, validateRequest, async (req, res, next) => {
  try {
    const floorId = parseInt(req.params.id);

    await floorService.reactivateFloor(req.session.user.id, floorId, req.ip);

    logger.info('Floor reactivated', {
      floorId,
      reactivatedBy: req.session.user.username
    });

    successRedirect(req, res, 'Floor reactivated successfully', '/admin/floors');
  } catch (error) {
    logger.error('Error reactivating floor', { error: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
