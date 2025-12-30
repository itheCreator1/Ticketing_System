const Ticket = require('../models/Ticket');
const User = require('../models/User');
const logger = require('../utils/logger');

class TicketService {
  async createTicket(ticketData) {
    const startTime = Date.now();
    try {
      logger.info('ticketService.createTicket: Creating new ticket', {
        reporterEmail: ticketData.reporter_email,
        priority: ticketData.priority,
        titleLength: ticketData.title?.length
      });

      const ticket = await Ticket.create(ticketData);
      const duration = Date.now() - startTime;

      logger.info('ticketService.createTicket: Ticket created successfully', {
        ticketId: ticket.id,
        reporterEmail: ticketData.reporter_email,
        priority: ticket.priority,
        status: ticket.status,
        duration
      });

      return ticket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.createTicket: Failed to create ticket', {
        reporterEmail: ticketData.reporter_email,
        priority: ticketData.priority,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  async getTicketById(id) {
    return await Ticket.findById(id);
  }

  async getAllTickets(filters = {}) {
    const cleanFilters = {
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      search: filters.search || undefined
    };

    return await Ticket.findAll(cleanFilters);
  }

  async updateTicket(id, updates) {
    const startTime = Date.now();
    const changedFields = Object.keys(updates).filter(key => updates[key] !== undefined);

    try {
      logger.info('ticketService.updateTicket: Ticket update initiated', { ticketId: id, changedFields });

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
            logger.warn('ticketService.updateTicket: Cannot assign to inactive or non-existent user', {
              ticketId: id,
              assignedUserId: updates.assigned_to,
              userFound: !!assignedUser,
              userStatus: assignedUser?.status
            });
            throw new Error('Cannot assign to inactive or non-existent user');
          }
          allowedUpdates.assigned_to = updates.assigned_to;
          logger.debug('ticketService.updateTicket: Ticket assigned', { ticketId: id, assignedToUserId: updates.assigned_to, assignedToUsername: assignedUser.username });
        }
      }

      const updatedTicket = await Ticket.update(id, allowedUpdates);
      const duration = Date.now() - startTime;

      logger.info('ticketService.updateTicket: Ticket updated successfully', {
        ticketId: id,
        changedFields,
        newStatus: updatedTicket.status,
        newPriority: updatedTicket.priority,
        assignedTo: updatedTicket.assigned_to,
        duration
      });

      return updatedTicket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('ticketService.updateTicket: Failed to update ticket', {
        ticketId: id,
        changedFields,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }
}

module.exports = new TicketService();
