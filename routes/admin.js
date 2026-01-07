const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Comment = require('../models/Comment');
const { validateRequest } = require('../middleware/validation');
const { TICKET_MESSAGES, COMMENT_MESSAGES } = require('../constants/messages');
const ticketService = require('../services/ticketService');
const { validateTicketUpdate, validateTicketId } = require('../validators/ticketValidators');
const { validateCommentCreation } = require('../validators/commentValidators');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');

router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try {
    const tickets = await ticketService.getAllTickets(req.query);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      tickets,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

router.get('/tickets/:id', validateTicketId, validateRequest, async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    const comments = await Comment.findByTicketId(req.params.id);

    if (!ticket) {
      return errorRedirect(req, res, TICKET_MESSAGES.NOT_FOUND, '/admin/dashboard');
    }

    res.render('admin/ticket-detail', {
      title: `Ticket #${ticket.id}`,
      ticket,
      comments
    });
  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:id/update', requireAdmin, validateTicketId, validateTicketUpdate, validateRequest, async (req, res, next) => {
  try {
    await ticketService.updateTicket(req.params.id, req.body);
    successRedirect(req, res, TICKET_MESSAGES.UPDATED, `/admin/tickets/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:id/comments', validateTicketId, validateCommentCreation, validateRequest, async (req, res, next) => {
  try {
    // Admin can choose visibility: checkbox 'is_internal' determines visibility_type
    const visibility_type = req.body.is_internal === 'on' ? 'internal' : 'public';

    await Comment.create({
      ticket_id: req.params.id,
      user_id: req.session.user.id,
      content: req.body.content,
      visibility_type
    });

    successRedirect(req, res, COMMENT_MESSAGES.ADDED, `/admin/tickets/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
