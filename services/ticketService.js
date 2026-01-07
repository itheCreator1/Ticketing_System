const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { TICKET_STATUS, TICKET_PRIORITY } = require('../constants/enums');

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

  async getDashboardData(filters = {}, page = 1, limit = 50) {
    const startTime = Date.now();
    try {
      // Parse page number
      const pageNum = parseInt(page) || 1;
      const pageLimit = parseInt(limit) || 50;

      logger.debug('ticketService.getDashboardData: Fetching dashboard data', { filters, page: pageNum, limit: pageLimit });

      // Parallel queries for performance
      const [paginatedResult, statusCounts, priorityCounts] = await Promise.all([
        Ticket.findAllPaginated(filters, pageNum, pageLimit),
        Ticket.getCountsByStatus(),
        Ticket.getCountsByPriority()
      ]);

      const { tickets, pagination } = paginatedResult;

      // Get last comments for displayed tickets
      const ticketIds = tickets.map(t => t.id);
      const lastComments = ticketIds.length > 0
        ? await Comment.getLastCommentsByTicketIds(ticketIds)
        : [];

      // Map comments to tickets
      const commentMap = {};
      lastComments.forEach(comment => {
        commentMap[comment.ticket_id] = comment;
      });

      // Convert counts to object format
      const statusCountMap = {};
      statusCounts.forEach(({ status, count }) => {
        statusCountMap[status] = parseInt(count);
      });

      const priorityCountMap = {};
      priorityCounts.forEach(({ priority, count }) => {
        priorityCountMap[priority] = parseInt(count);
      });

      const duration = Date.now() - startTime;
      logger.debug('ticketService.getDashboardData: Dashboard data fetched', {
        ticketCount: tickets.length,
        totalTickets: pagination.totalCount,
        page: pageNum,
        duration
      });

      return {
        tickets,
        pagination,
        statusCounts: statusCountMap,
        priorityCounts: priorityCountMap,
        lastComments: commentMap
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.getDashboardData: Failed to fetch dashboard data', {
        filters,
        page,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  async bulkUpdateTickets(ticketIds, updates, actorId, ipAddress, auditContext = {}) {
    const startTime = Date.now();
    try {
      logger.info('ticketService.bulkUpdateTickets: Bulk update initiated', {
        ticketCount: ticketIds.length,
        updates,
        actorId
      });

      // Validate inputs
      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        throw new Error('No tickets selected');
      }

      if (ticketIds.length > 100) {
        throw new Error('Cannot update more than 100 tickets at once');
      }

      // Validate status if provided
      if (updates.status && !Object.values(TICKET_STATUS).includes(updates.status)) {
        throw new Error('Invalid status');
      }

      // Validate priority if provided
      if (updates.priority && !Object.values(TICKET_PRIORITY).includes(updates.priority)) {
        throw new Error('Invalid priority');
      }

      // Validate assigned user if provided
      if (updates.assigned_to !== undefined && updates.assigned_to !== null) {
        const user = await User.findById(updates.assigned_to);
        if (!user || user.status !== 'active') {
          throw new Error('Invalid assigned user');
        }
      }

      // Update tickets
      const updatedTickets = await Ticket.bulkUpdate(ticketIds, updates);

      // Create audit log entry for each ticket
      await Promise.all(
        updatedTickets.map(ticket =>
          AuditLog.create({
            actorId,
            action: 'ticket_bulk_updated',
            targetType: 'ticket',
            targetId: ticket.id,
            details: { ...updates, bulkOperation: true },
            ipAddress,
            actorUsername: auditContext.actorUsername,
            actorRole: auditContext.actorRole,
            sessionHash: auditContext.sessionHash,
          })
        )
      );

      const duration = Date.now() - startTime;
      logger.info('ticketService.bulkUpdateTickets: Bulk update completed', {
        updatedCount: updatedTickets.length,
        updates,
        duration
      });

      return updatedTickets;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.bulkUpdateTickets: Bulk update failed', {
        ticketCount: ticketIds?.length,
        updates,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }
}

module.exports = new TicketService();
