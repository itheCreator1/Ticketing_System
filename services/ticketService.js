const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class TicketService {
  async createTicket(ticketData) {
    const startTime = Date.now();
    try {
      logger.info('ticketService.createTicket: Creating new ticket', {
        reporterDepartment: ticketData.reporter_department,
        priority: ticketData.priority,
        titleLength: ticketData.title?.length,
      });

      const ticket = await Ticket.create(ticketData);
      const duration = Date.now() - startTime;

      logger.info('ticketService.createTicket: Ticket created successfully', {
        ticketId: ticket.id,
        reporterDepartment: ticketData.reporter_department,
        priority: ticket.priority,
        status: ticket.status,
        duration,
      });

      return ticket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.createTicket: Failed to create ticket', {
        reporterDepartment: ticketData.reporter_department,
        priority: ticketData.priority,
        error: error.message,
        stack: error.stack,
        duration,
      });
      throw error;
    }
  }

  async getTicketById(id) {
    return Ticket.findById(id);
  }

  async getAllTickets(filters = {}) {
    const cleanFilters = {
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      search: filters.search || undefined,
    };

    return Ticket.findAll(cleanFilters);
  }

  async updateTicket(id, updates, actorId = null, ipAddress = null, auditContext = {}) {
    const startTime = Date.now();
    const changedFields = Object.keys(updates).filter((key) => updates[key] !== undefined);

    try {
      logger.info('ticketService.updateTicket: Ticket update initiated', {
        ticketId: id,
        changedFields,
      });

      const allowedUpdates = {};

      if (updates.status) {
        allowedUpdates.status = updates.status;
      }

      if (updates.priority) {
        allowedUpdates.priority = updates.priority;
      }

      // Validate and handle assigned_to
      if (updates.assigned_to !== undefined) {
        // Allow null to unassign
        if (updates.assigned_to === null || updates.assigned_to === '') {
          allowedUpdates.assigned_to = null;
          logger.debug('ticketService.updateTicket: Ticket unassigned', { ticketId: id });
        } else {
          // Validate that the user exists and is active
          const assignedUser = await User.findById(updates.assigned_to);
          if (!assignedUser || assignedUser.status !== 'active') {
            logger.warn(
              'ticketService.updateTicket: Cannot assign to inactive or non-existent user',
              {
                ticketId: id,
                assignedUserId: updates.assigned_to,
                userFound: !!assignedUser,
                userStatus: assignedUser?.status,
              }
            );
            throw new Error('Cannot assign to inactive or non-existent user');
          }
          allowedUpdates.assigned_to = updates.assigned_to;
          logger.debug('ticketService.updateTicket: Ticket assigned', {
            ticketId: id,
            assignedToUserId: updates.assigned_to,
            assignedToUsername: assignedUser.username,
          });
        }
      }

      const updatedTicket = await Ticket.update(id, allowedUpdates);

      // Audit log
      if (actorId) {
        await AuditLog.create({
          actorId,
          action: 'TICKET_UPDATED',
          targetType: 'ticket',
          targetId: parseInt(id),
          details: allowedUpdates,
          ipAddress,
          actorUsername: auditContext.actorUsername,
          actorRole: auditContext.actorRole,
          sessionHash: auditContext.sessionHash,
        });
      }

      const duration = Date.now() - startTime;

      logger.info('ticketService.updateTicket: Ticket updated successfully', {
        ticketId: id,
        changedFields,
        newStatus: updatedTicket.status,
        newPriority: updatedTicket.priority,
        assignedTo: updatedTicket.assigned_to,
        duration,
      });

      return updatedTicket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.updateTicket: Failed to update ticket', {
        ticketId: id,
        changedFields,
        error: error.message,
        stack: error.stack,
        duration,
      });
      throw error;
    }
  }
  async addComment(ticketId, userId, content, visibilityType, ipAddress = null, auditContext = {}) {
    const startTime = Date.now();
    try {
      logger.info('ticketService.addComment: Adding comment', {
        ticketId,
        userId,
        visibilityType,
        contentLength: content?.length,
      });

      // Get current ticket to check status for auto-status update
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const comment = await Comment.create({
        ticket_id: ticketId,
        user_id: userId,
        content,
        visibility_type: visibilityType,
      });

      await AuditLog.create({
        actorId: userId,
        action: 'COMMENT_CREATED',
        targetType: 'comment',
        targetId: comment.id,
        details: {
          ticketId: parseInt(ticketId, 10),
          visibility: visibilityType,
        },
        ipAddress,
        actorUsername: auditContext.actorUsername,
        actorRole: auditContext.actorRole,
        sessionHash: auditContext.sessionHash,
      });

      // AUTO-STATUS UPDATE: Admin adding PUBLIC comment → "waiting_on_department"
      // ONLY if: public comment AND ticket not closed AND has reporter_id (dept ticket)
      if (visibilityType === 'public' && ticket.status !== 'closed' && ticket.reporter_id !== null) {
        await this.updateTicket(
          ticketId,
          { status: 'waiting_on_department' },
          userId,
          ipAddress,
          auditContext
        );
        logger.info('ticketService.addComment: Auto-updated status to waiting_on_department', {
          ticketId,
          oldStatus: ticket.status,
        });
      }

      const duration = Date.now() - startTime;
      logger.info('ticketService.addComment: Comment added successfully', {
        commentId: comment.id,
        ticketId,
        userId,
        visibilityType,
        duration,
      });

      return comment;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.addComment: Failed to add comment', {
        ticketId,
        userId,
        error: error.message,
        stack: error.stack,
        duration,
      });
      throw error;
    }
  }
}

module.exports = new TicketService();
