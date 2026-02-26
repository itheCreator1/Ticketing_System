const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { requireAuth, requireDepartment } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { validateTicketId } = require('../validators/ticketValidators');
const {
  validateClientTicketCreation,
  validateClientStatusUpdate,
  validateClientCommentCreation,
} = require('../validators/clientValidators');
const clientTicketService = require('../services/clientTicketService');
const { TICKET_MESSAGES, COMMENT_MESSAGES } = require('../constants/messages');
const { TICKET_STATUS, TICKET_PRIORITY } = require('../constants/enums');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

// Apply authentication middleware to all client routes
router.use(requireAuth, requireDepartment);

/**
 * GET /client/dashboard
 * Display all tickets for the logged-in department user
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
    };

    const tickets = await clientTicketService.getDepartmentTickets(
      req.session.user.id,
      req.session.user.department,
      filters
    );

    res.render('client/dashboard', {
      title: 'My Tickets',
      tickets,
      filters,
      TICKET_STATUS,
      TICKET_PRIORITY,
    });
  } catch (error) {
    logger.error('Client dashboard error', {
      userId: req.session.user.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

/**
 * GET /client/tickets/new
 * Display form to create a new ticket
 */
router.get('/tickets/new', (req, res) => {
  res.render('client/new-ticket', {
    title: 'Create New Ticket',
  });
});

/**
 * POST /client/tickets
 * Create a new ticket for the department user
 */
router.post('/tickets', validateClientTicketCreation, validateRequest, async (req, res, next) => {
  try {
    const ticketData = {
      title: req.body.title,
      description: req.body.description,
      reporter_phone: req.body.reporter_phone,
    };

    const auditContext = {
      actorUsername: req.session.user.username,
      actorRole: req.session.user.role,
      sessionHash: crypto
        .createHash('sha256')
        .update(req.sessionID)
        .digest('hex')
        .substring(0, 16),
    };
    const ticket = await clientTicketService.createTicket(
      req.session.user.id,
      ticketData,
      req.ip,
      auditContext
    );

    logger.info('Department user created ticket', {
      ticketId: ticket.id,
      userId: req.session.user.id,
      department: ticket.reporter_department,
    });

    successRedirect(req, res, TICKET_MESSAGES.CREATED, `/client/tickets/${ticket.id}`);
  } catch (error) {
    logger.error('Client ticket creation error', {
      userId: req.session.user.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

/**
 * GET /client/tickets/:id
 * Display single ticket detail (with ownership verification)
 */
router.get('/tickets/:id', validateTicketId, validateRequest, async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const ticket = await clientTicketService.getTicketById(ticketId);

    if (!ticket) {
      return errorRedirect(req, res, TICKET_MESSAGES.NOT_FOUND, '/client/dashboard');
    }

    // CRITICAL: Department-based access control
    // Allow access if ticket belongs to user's department AND is not an internal admin ticket
    if (ticket.reporter_department !== req.session.user.department) {
      logger.warn('Department access violation attempt', {
        ticketId,
        userId: req.session.user.id,
        userDepartment: req.session.user.department,
        ticketDepartment: ticket.reporter_department,
        ip: req.ip,
      });
      return errorRedirect(req, res, TICKET_MESSAGES.UNAUTHORIZED_ACCESS, '/client/dashboard');
    }

    // Additional security: Block internal admin tickets (defense in depth)
    if (ticket.is_admin_created === true) {
      logger.warn('Internal ticket access attempt', {
        ticketId,
        userId: req.session.user.id,
        userDepartment: req.session.user.department,
        ip: req.ip,
      });
      return errorRedirect(req, res, TICKET_MESSAGES.UNAUTHORIZED_ACCESS, '/client/dashboard');
    }

    // Get visible comments (public only for department users)
    const comments = await clientTicketService.getVisibleComments(ticketId);

    res.render('client/ticket-detail', {
      title: `Ticket #${ticket.id}`,
      ticket,
      comments,
      TICKET_STATUS,
    });
  } catch (error) {
    logger.error('Client ticket detail error', {
      ticketId: req.params.id,
      userId: req.session.user.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

/**
 * POST /client/tickets/:id/comments
 * Add a comment to a ticket (with ownership verification)
 */
router.post(
  '/tickets/:id/comments',
  validateTicketId,
  validateClientCommentCreation,
  validateRequest,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const ticket = await clientTicketService.getTicketById(ticketId);

      if (!ticket) {
        return errorRedirect(req, res, TICKET_MESSAGES.NOT_FOUND, '/client/dashboard');
      }

      // CRITICAL: Department-based access control
      // Allow access if ticket belongs to user's department AND is not an internal admin ticket
      if (ticket.reporter_department !== req.session.user.department) {
        logger.warn('Comment department access violation attempt', {
          ticketId,
          userId: req.session.user.id,
          userDepartment: req.session.user.department,
          ticketDepartment: ticket.reporter_department,
          ip: req.ip,
        });
        return errorRedirect(req, res, TICKET_MESSAGES.UNAUTHORIZED_ACCESS, '/client/dashboard');
      }

      // Additional security: Block internal admin tickets (defense in depth)
      if (ticket.is_admin_created === true) {
        logger.warn('Internal ticket comment attempt', {
          ticketId,
          userId: req.session.user.id,
          userDepartment: req.session.user.department,
          ip: req.ip,
        });
        return errorRedirect(req, res, TICKET_MESSAGES.UNAUTHORIZED_ACCESS, '/client/dashboard');
      }

      const commentAuditContext = {
        actorUsername: req.session.user.username,
        actorRole: req.session.user.role,
        sessionHash: crypto
          .createHash('sha256')
          .update(req.sessionID)
          .digest('hex')
          .substring(0, 16),
      };
      await clientTicketService.addComment(
        ticketId,
        req.session.user.id,
        req.body.content,
        req.ip,
        commentAuditContext
      );

      logger.info('Department user added comment', {
        ticketId,
        userId: req.session.user.id,
      });

      successRedirect(req, res, COMMENT_MESSAGES.ADDED, `/client/tickets/${ticketId}`);
    } catch (error) {
      logger.error('Client comment creation error', {
        ticketId: req.params.id,
        userId: req.session.user.id,
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

/**
 * POST /client/tickets/:id/status
 * Update ticket status (with ownership verification)
 */
router.post(
  '/tickets/:id/status',
  validateTicketId,
  validateClientStatusUpdate,
  validateRequest,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const ticket = await clientTicketService.getTicketById(ticketId);

      if (!ticket) {
        return errorRedirect(req, res, TICKET_MESSAGES.NOT_FOUND, '/client/dashboard');
      }

      // CRITICAL: Department-based access control
      // Allow access if ticket belongs to user's department AND is not an internal admin ticket
      if (ticket.reporter_department !== req.session.user.department) {
        logger.warn('Status update department access violation attempt', {
          ticketId,
          userId: req.session.user.id,
          userDepartment: req.session.user.department,
          ticketDepartment: ticket.reporter_department,
          ip: req.ip,
        });
        return errorRedirect(req, res, TICKET_MESSAGES.UNAUTHORIZED_ACCESS, '/client/dashboard');
      }

      // Additional security: Block internal admin tickets (defense in depth)
      if (ticket.is_admin_created === true) {
        logger.warn('Internal ticket status update attempt', {
          ticketId,
          userId: req.session.user.id,
          userDepartment: req.session.user.department,
          ip: req.ip,
        });
        return errorRedirect(req, res, TICKET_MESSAGES.UNAUTHORIZED_ACCESS, '/client/dashboard');
      }

      await clientTicketService.updateTicketStatus(ticketId, req.body.status);

      logger.info('Department user updated ticket status', {
        ticketId,
        userId: req.session.user.id,
        newStatus: req.body.status,
      });

      successRedirect(req, res, TICKET_MESSAGES.STATUS_CHANGED, `/client/tickets/${ticketId}`);
    } catch (error) {
      logger.error('Client status update error', {
        ticketId: req.params.id,
        userId: req.session.user.id,
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

module.exports = router;
