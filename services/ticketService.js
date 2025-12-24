const Ticket = require('../models/Ticket');

class TicketService {
  async createTicket(ticketData) {
    return await Ticket.create(ticketData);
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
    const allowedUpdates = {};

    if (updates.status) {
      allowedUpdates.status = updates.status;
    }

    if (updates.priority) {
      allowedUpdates.priority = updates.priority;
    }

    return await Ticket.update(id, allowedUpdates);
  }
}

module.exports = new TicketService();
