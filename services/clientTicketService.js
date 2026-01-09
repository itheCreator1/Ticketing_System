const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Service for department user ticket operations
 * Implements ownership-aware business logic for client portal
 */
class ClientTicketService {
  /**
   * Create a new ticket for a department user
   * Automatically sets reporter_id to link ticket to department account
   */
  async createTicket(userId, ticketData) {
    const startTime = Date.now();
    try {
      logger.info('clientTicketService.createTicket: Creating ticket for department user', {
        userId,
        titleLength: ticketData.title?.length
      });

      // CRITICAL: Fetch user to get their department
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // CRITICAL: Department users MUST have a department set
      if (!user.department) {
        throw new Error('Department not set for user. Please contact an administrator.');
      }

      // Auto-populate department from user profile
      // Force priority to 'unset' (department users cannot set priority)
      const ticket = await Ticket.create({
        title: ticketData.title,
        description: ticketData.description,
        reporter_department: user.department,  // AUTO-POPULATED from user
        reporter_phone: ticketData.reporter_phone,
        reporter_id: userId,  // Ownership enforcement
        priority: 'unset',  // FORCED - department users cannot set priority
        status: 'open'  // Department-created tickets always start as 'open'
      });

      const duration = Date.now() - startTime;

      logger.info('clientTicketService.createTicket: Ticket created successfully', {
        ticketId: ticket.id,
        userId,
        department: user.department,  // Log actual department used
        duration
      });

      return ticket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('clientTicketService.createTicket: Failed to create ticket', {
        userId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  /**
   * Get all tickets for a department user (ownership-based)
   * Only returns tickets where reporter_id matches userId
   */
  async getDepartmentTickets(userId, filters = {}) {
    const startTime = Date.now();
    try {
      logger.debug('clientTicketService.getDepartmentTickets: Fetching tickets', { userId, filters });

      const cleanFilters = {
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined
      };

      const tickets = await Ticket.findByDepartment(userId, cleanFilters);
      const duration = Date.now() - startTime;

      logger.debug('clientTicketService.getDepartmentTickets: Tickets fetched', {
        userId,
        ticketCount: tickets.length,
        duration
      });

      return tickets;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('clientTicketService.getDepartmentTickets: Failed to fetch tickets', {
        userId,
        filters,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  /**
   * Get a single ticket by ID
   * Note: Ownership verification must be done in route layer
   */
  async getTicketById(id) {
    return await Ticket.findById(id);
  }

  /**
   * Get comments for a ticket (department users only see public comments)
   * Uses Comment.findVisibleByTicketId with 'department' role
   */
  async getVisibleComments(ticketId) {
    const startTime = Date.now();
    try {
      logger.debug('clientTicketService.getVisibleComments: Fetching comments', { ticketId });

      const comments = await Comment.findVisibleByTicketId(ticketId, 'department');
      const duration = Date.now() - startTime;

      logger.debug('clientTicketService.getVisibleComments: Comments fetched', {
        ticketId,
        commentCount: comments.length,
        duration
      });

      return comments;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('clientTicketService.getVisibleComments: Failed to fetch comments', {
        ticketId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  /**
   * Add a public comment to a ticket
   * Department users can only add public comments (no internal notes)
   */
  async addComment(ticketId, userId, content) {
    const startTime = Date.now();
    try {
      logger.info('clientTicketService.addComment: Adding comment', { ticketId, userId, contentLength: content?.length });

      // Get current ticket to check status
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Force visibility_type to 'public' for department users
      const comment = await Comment.create({
        ticket_id: ticketId,
        user_id: userId,
        content,
        visibility_type: 'public'
      });

      // AUTO-STATUS UPDATE: Department user adding public comment → "waiting_on_admin"
      // EXCEPTION: Do NOT reopen closed tickets
      if (ticket.status !== 'closed') {
        await Ticket.update(ticketId, { status: 'waiting_on_admin' });
        logger.info('clientTicketService.addComment: Auto-updated status to waiting_on_admin', {
          ticketId,
          oldStatus: ticket.status
        });
      } else {
        logger.debug('clientTicketService.addComment: Skipped status update (ticket closed)', { ticketId });
      }

      const duration = Date.now() - startTime;

      logger.info('clientTicketService.addComment: Comment added successfully', {
        commentId: comment.id,
        ticketId,
        userId,
        statusUpdated: ticket.status !== 'closed',
        duration
      });

      return comment;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('clientTicketService.addComment: Failed to add comment', {
        ticketId,
        userId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  /**
   * Update ticket status (department users have limited status options)
   * Allowed status transitions for department users:
   * - open -> waiting_on_admin (requesting admin help)
   * - waiting_on_department -> waiting_on_admin (responding to admin)
   * - waiting_on_department -> closed (resolving their issue)
   */
  async updateTicketStatus(ticketId, status) {
    const startTime = Date.now();

    // Validate allowed status values for department users
    const allowedStatuses = ['waiting_on_admin', 'closed'];
    if (!allowedStatuses.includes(status)) {
      const error = new Error(`Department users cannot set status to: ${status}`);
      logger.warn('clientTicketService.updateTicketStatus: Invalid status for department user', {
        ticketId,
        attemptedStatus: status
      });
      throw error;
    }

    try {
      logger.info('clientTicketService.updateTicketStatus: Updating ticket status', { ticketId, status });

      const updatedTicket = await Ticket.update(ticketId, { status });
      const duration = Date.now() - startTime;

      logger.info('clientTicketService.updateTicketStatus: Status updated successfully', {
        ticketId,
        newStatus: status,
        duration
      });

      return updatedTicket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('clientTicketService.updateTicketStatus: Failed to update status', {
        ticketId,
        status,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }
}

module.exports = new ClientTicketService();
