/**
 * Admin Ticket Service Unit Tests
 *
 * Tests the AdminTicketService in isolation with all dependencies mocked.
 * Covers two types of admin ticket creation:
 * 1. Internal tickets (is_admin_created=true) - Hidden from department users
 * 2. Department tickets (is_admin_created=false) - Visible to department users
 */

const adminTicketService = require('../../../services/adminTicketService');
const Ticket = require('../../../models/Ticket');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');

// Mock dependencies
jest.mock('../../../models/Ticket');
jest.mock('../../../models/User');
jest.mock('../../../models/AuditLog');
jest.mock('../../../utils/logger');

describe('Admin Ticket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAdminTicket', () => {
    it('should create admin ticket with is_admin_created=true', async () => {
      // Arrange
      const adminUserId = 1;
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Internal ticket',
        description: 'Admin-only ticket',
        reporter_department: 'Internal',
        priority: 'medium',
        status: 'open',
      };
      const mockTicket = { id: 1, ...ticketData, is_admin_created: true, reporter_id: adminUserId };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await adminTicketService.createAdminTicket(
        adminUserId,
        ticketData,
        '127.0.0.1'
      );

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_admin_created: true })
      );
      expect(result.is_admin_created).toBe(true);
    });

    it('should set reporter_id to admin user ID', async () => {
      // Arrange
      const adminUserId = 42;
      const adminUser = { id: 42, username: 'admin', role: 'admin' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };
      const mockTicket = { id: 1, reporter_id: 42 };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createAdminTicket(adminUserId, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ reporter_id: adminUserId })
      );
    });

    it('should auto-populate reporter_name with admin username', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'john.admin', role: 'super_admin' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };
      const mockTicket = { id: 1, reporter_name: 'john.admin' };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createAdminTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ reporter_name: 'john.admin' })
      );
    });

    it('should allow admin user to create admin ticket', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };
      const mockTicket = { id: 1 };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act & Assert
      await expect(
        adminTicketService.createAdminTicket(1, ticketData, '127.0.0.1')
      ).resolves.toBeDefined();
    });

    it('should allow super_admin user to create admin ticket', async () => {
      // Arrange
      const superAdmin = { id: 1, username: 'superadmin', role: 'super_admin' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };
      const mockTicket = { id: 1 };

      User.findById.mockResolvedValue(superAdmin);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act & Assert
      await expect(
        adminTicketService.createAdminTicket(1, ticketData, '127.0.0.1')
      ).resolves.toBeDefined();
    });

    it('should reject non-admin user (department role)', async () => {
      // Arrange
      const deptUser = { id: 1, username: 'deptuser', role: 'department' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };

      User.findById.mockResolvedValue(deptUser);

      // Act & Assert
      await expect(
        adminTicketService.createAdminTicket(1, ticketData, '127.0.0.1')
      ).rejects.toThrow('Only admins can create admin tickets');

      expect(Ticket.create).not.toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };

      // Act & Assert
      await expect(
        adminTicketService.createAdminTicket(999, ticketData, '127.0.0.1')
      ).rejects.toThrow('Admin user not found');
    });

    it('should use default priority unset when not provided', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };
      const mockTicket = { id: 1, priority: 'unset' };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createAdminTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'unset' }));
    });

    it('should use default status open when not provided', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = { title: 'Test', description: 'Test', reporter_department: 'Internal' };
      const mockTicket = { id: 1, status: 'open' };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createAdminTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
    });

    it('should create audit log with CREATE_ADMIN_TICKET action', async () => {
      // Arrange
      const adminUserId = 1;
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test Ticket',
        description: 'Test',
        reporter_department: 'Internal',
        priority: 'high',
        status: 'open',
      };
      const mockTicket = { id: 10, ...ticketData };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createAdminTicket(adminUserId, ticketData, '192.168.1.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: adminUserId,
        action: 'CREATE_ADMIN_TICKET',
        targetType: 'ticket',
        targetId: 10,
        details: expect.objectContaining({
          title: 'Test Ticket',
          priority: 'high',
          status: 'open',
          department: 'Internal',
        }),
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('createDepartmentTicket', () => {
    it('should create department ticket with is_admin_created=false', async () => {
      // Arrange
      const adminUserId = 1;
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Dept ticket',
        description: 'Created on behalf of dept',
        reporter_name: 'Department Contact',
        reporter_department: 'Emergency Department',
        priority: 'medium',
      };
      const mockTicket = { id: 1, ...ticketData, is_admin_created: false };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await adminTicketService.createDepartmentTicket(
        adminUserId,
        ticketData,
        '127.0.0.1'
      );

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_admin_created: false })
      );
      expect(result.is_admin_created).toBe(false);
    });

    it('should set reporter_id to NULL for anonymous ticket', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'John Doe',
        reporter_department: 'Cardiology',
      };
      const mockTicket = { id: 1, reporter_id: null };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: null }));
    });

    it('should use reporter_name from form input (not auto-populated)', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Dr. Sarah Johnson',
        reporter_department: 'Radiology',
      };
      const mockTicket = { id: 1 };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ reporter_name: 'Dr. Sarah Johnson' })
      );
    });

    it('should force status to open', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Pharmacy',
        status: 'closed', // Admin tries to set different status
      };
      const mockTicket = { id: 1, status: 'open' };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
    });

    it('should reject Internal department', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Internal', // System department not allowed
      };

      User.findById.mockResolvedValue(adminUser);

      // Act & Assert
      await expect(
        adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1')
      ).rejects.toThrow('Cannot create department ticket for Internal department');

      expect(Ticket.create).not.toHaveBeenCalled();
    });

    it('should allow admin user to create department ticket', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Laboratory',
      };
      const mockTicket = { id: 1 };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act & Assert
      await expect(
        adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1')
      ).resolves.toBeDefined();
    });

    it('should allow super_admin user to create department ticket', async () => {
      // Arrange
      const superAdmin = { id: 1, username: 'superadmin', role: 'super_admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Surgery',
      };
      const mockTicket = { id: 1 };

      User.findById.mockResolvedValue(superAdmin);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act & Assert
      await expect(
        adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1')
      ).resolves.toBeDefined();
    });

    it('should reject non-admin user', async () => {
      // Arrange
      const deptUser = { id: 1, username: 'deptuser', role: 'department' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Cardiology',
      };

      User.findById.mockResolvedValue(deptUser);

      // Act & Assert
      await expect(
        adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1')
      ).rejects.toThrow('Only admins can create department tickets');

      expect(Ticket.create).not.toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Radiology',
      };

      // Act & Assert
      await expect(
        adminTicketService.createDepartmentTicket(999, ticketData, '127.0.0.1')
      ).rejects.toThrow('Admin user not found');
    });

    it('should use default priority unset when not provided', async () => {
      // Arrange
      const adminUser = { id: 1, username: 'admin', role: 'admin' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        reporter_name: 'Contact',
        reporter_department: 'Pharmacy',
      };
      const mockTicket = { id: 1 };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createDepartmentTicket(1, ticketData, '127.0.0.1');

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'unset' }));
    });

    it('should create audit log with CREATE_DEPARTMENT_TICKET action', async () => {
      // Arrange
      const adminUserId = 1;
      const adminUser = { id: 1, username: 'admin.user', role: 'admin' };
      const ticketData = {
        title: 'Patient Monitor Issue',
        description: 'Monitor not working',
        reporter_name: 'Dr. Smith',
        reporter_department: 'Intensive Care Unit',
        priority: 'high',
      };
      const mockTicket = { id: 20, ...ticketData };

      User.findById.mockResolvedValue(adminUser);
      Ticket.create.mockResolvedValue(mockTicket);
      AuditLog.create.mockResolvedValue({});

      // Act
      await adminTicketService.createDepartmentTicket(adminUserId, ticketData, '10.0.0.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: adminUserId,
        action: 'CREATE_DEPARTMENT_TICKET',
        targetType: 'ticket',
        targetId: 20,
        details: expect.objectContaining({
          title: 'Patient Monitor Issue',
          priority: 'high',
          department: 'Intensive Care Unit',
          reporter_name: 'Dr. Smith',
          createdBy: 'admin.user',
        }),
        ipAddress: '10.0.0.1',
      });
    });
  });
});
