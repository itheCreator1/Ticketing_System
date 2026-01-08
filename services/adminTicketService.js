const Ticket = require('../models/Ticket');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Service for admin internal ticket operations
 * Handles creation of admin-only internal tickets
 */
class AdminTicketService {
  /**
   * Create an internal ticket (admin-only)
   * Automatically sets:
   * - reporter_department = 'Internal'
   * - reporter_id = admin user ID
   * - reporter_name = admin username
   *
   * @param {number} adminUserId - The ID of the admin creating the ticket
   * @param {Object} ticketData - The ticket data
   * @param {string} ticketData.title - Ticket title
   * @param {string} ticketData.description - Ticket description
   * @param {string} ticketData.reporter_desk - Desk location
   * @param {string} [ticketData.reporter_phone] - Optional phone number
   * @param {string} [ticketData.priority='unset'] - Optional priority
   * @param {string} [ticketData.status='open'] - Optional status
   * @param {string} ipAddress - IP address of the admin
   * @returns {Promise<Object>} The created ticket
   * @throws {Error} If user is not found or not an admin
   */
  async createInternalTicket(adminUserId, ticketData, ipAddress) {
    const startTime = Date.now();
    try {
      logger.info('adminTicketService.createInternalTicket: Creating internal ticket', {
        adminUserId,
        desk: ticketData.reporter_desk,
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
        logger.warn('adminTicketService.createInternalTicket: Non-admin attempted to create internal ticket', {
          userId: adminUserId,
          userRole: admin.role,
          ip: ipAddress
        });
        throw new Error('Only admins can create internal tickets');
      }

      // Create internal ticket with auto-populated fields
      const ticket = await Ticket.create({
        title: ticketData.title,
        description: ticketData.description,
        reporter_department: 'Internal',  // CRITICAL: Always 'Internal'
        reporter_desk: ticketData.reporter_desk,
        reporter_phone: ticketData.reporter_phone || null,
        reporter_name: admin.username,  // Auto-populate with admin username
        reporter_id: adminUserId,  // Link to creating admin
        priority: ticketData.priority || 'unset',
        status: ticketData.status || 'open'
      });

      // Audit log for internal ticket creation
      await AuditLog.create({
        actorId: adminUserId,
        action: 'CREATE_INTERNAL_TICKET',
        targetType: 'ticket',
        targetId: ticket.id,
        details: {
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          department: 'Internal'
        },
        ipAddress
      });

      const duration = Date.now() - startTime;

      logger.info('adminTicketService.createInternalTicket: Internal ticket created successfully', {
        ticketId: ticket.id,
        adminUserId,
        adminUsername: admin.username,
        priority: ticket.priority,
        duration
      });

      return ticket;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('adminTicketService.createInternalTicket: Failed to create internal ticket', {
        adminUserId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }
}

module.exports = new AdminTicketService();
