const Ticket = require('../models/Ticket');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Service for admin ticket operations
 * Handles creation of admin-created tickets (hidden from department users)
 */
class AdminTicketService {
  /**
   * Create an admin ticket
   * Automatically sets:
   * - is_admin_created = true (hidden from department users)
   * - reporter_id = admin user ID
   * - reporter_name = admin username
   * Admins can select any department (IT Support, General Support, HR, Finance, Facilities, Internal)
   *
   * @param {number} adminUserId - The ID of the admin creating the ticket
   * @param {Object} ticketData - The ticket data
   * @param {string} ticketData.title - Ticket title
   * @param {string} ticketData.description - Ticket description
   * @param {string} ticketData.reporter_department - Department (admin selectable)
   * @param {string} [ticketData.reporter_phone] - Optional phone number
   * @param {string} [ticketData.priority='unset'] - Optional priority
   * @param {string} [ticketData.status='open'] - Optional status
   * @param {string} ipAddress - IP address of the admin
   * @returns {Promise<Object>} The created ticket
   * @throws {Error} If user is not found or not an admin
   */
  async createAdminTicket(adminUserId, ticketData, ipAddress) {
    const startTime = Date.now();
    try {
      logger.info('adminTicketService.createAdminTicket: Creating admin ticket', {
        adminUserId,
        department: ticketData.reporter_department,
        priority: ticketData.priority,
        titleLength: ticketData.title?.length
      });

      // Fetch admin user for name
      const admin = await User.findById(adminUserId);
      if (!admin) {
        throw new Error('Admin user not found');
      }

      // Verify user is admin or super_admin
      if (admin.role !== 'admin' && admin.role !== 'super_admin') {
        logger.warn('adminTicketService.createAdminTicket: Non-admin attempted to create admin ticket', {
          userId: adminUserId,
          userRole: admin.role,
          ip: ipAddress
        });
        throw new Error('Only admins can create admin tickets');
      }

      // Create admin ticket with admin-selected department
      const ticket = await Ticket.create({
        title: ticketData.title,
        description: ticketData.description,
        reporter_department: ticketData.reporter_department,  // From form input
        reporter_phone: ticketData.reporter_phone || null,
        reporter_name: admin.username,  // Auto-populate with admin username
        reporter_id: adminUserId,  // Link to creating admin
        priority: ticketData.priority || 'unset',
        status: ticketData.status || 'open',
        is_admin_created: true  // CRITICAL: Always true for admin-created tickets
      });

      // Audit log for admin ticket creation
      await AuditLog.create({
        actorId: adminUserId,
        action: 'CREATE_ADMIN_TICKET',
        targetType: 'ticket',
        targetId: ticket.id,
        details: {
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          department: ticket.reporter_department
        },
        ipAddress
      });

      const duration = Date.now() - startTime;

      logger.info('adminTicketService.createAdminTicket: Admin ticket created successfully', {
        ticketId: ticket.id,
        adminUserId,
        adminUsername: admin.username,
        department: ticket.reporter_department,
        priority: ticket.priority,
        duration
      });

      return ticket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('adminTicketService.createAdminTicket: Failed to create admin ticket', {
        adminUserId,
        department: ticketData.reporter_department,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }
}

module.exports = new AdminTicketService();
