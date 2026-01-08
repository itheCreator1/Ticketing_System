const express = require('express');
const router = express.Router();
const errorReportingService = require('../services/errorReportingService');
const logger = require('../utils/logger');

/**
 * POST /api/errors/report
 * Submit an error report from the client side
 */
router.post('/report', async (req, res) => {
  try {
    const {
      correlationId,
      category,
      userDescription,
      additionalData
    } = req.body;

    // Validate required fields
    if (!correlationId) {
      return res.status(400).json({
        success: false,
        message: 'Correlation ID is required'
      });
    }

    // Get user context from session/request
    const userContext = {
      userId: req.session?.user?.id || 'anonymous',
      userAgent: req.get('User-Agent'),
      url: req.get('Referer') || req.originalUrl,
      ip: req.ip
    };

    // Submit the error report
    const result = await errorReportingService.reportError(
      correlationId,
      category || 'USER_REPORTED',
      userContext,
      userDescription || '',
      additionalData || {}
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    logger.error('Error in error reporting route', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while processing error report'
    });
  }
});

/**
 * GET /api/errors/stats
 * Get error statistics (admin only)
 */
router.get('/stats', (req, res) => {
  try {
    // Check if user is admin (you might want to add proper authorization here)
    if (!req.session?.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const stats = errorReportingService.getErrorStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting error stats', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve error statistics'
    });
  }
});

/**
 * GET /api/errors/reports
 * Get all error reports (admin only)
 */
router.get('/reports', (req, res) => {
  try {
    // Check if user is admin
    if (!req.session?.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const reports = errorReportingService.getAllReports();

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    logger.error('Error getting error reports', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve error reports'
    });
  }
});

/**
 * POST /api/errors/:correlationId/resolve
 * Mark an error report as resolved (admin only)
 */
router.post('/:correlationId/resolve', (req, res) => {
  try {
    // Check if user is admin
    if (!req.session?.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { correlationId } = req.params;
    const { resolution } = req.body;

    const success = errorReportingService.resolveReport(correlationId, resolution);

    if (success) {
      res.json({
        success: true,
        message: 'Error report marked as resolved'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Error report not found'
      });
    }

  } catch (error) {
    logger.error('Error resolving error report', {
      correlationId: req.params.correlationId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to resolve error report'
    });
  }
});

module.exports = router;