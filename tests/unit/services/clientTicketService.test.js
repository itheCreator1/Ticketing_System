/**
 * Client Ticket Service Unit Tests
 *
 * Tests the ClientTicketService in isolation with all dependencies mocked.
 * Focuses on ownership-aware business logic for department user portal.
 */

const clientTicketService = require('../../../services/clientTicketService');
const Ticket = require('../../../models/Ticket');
const Comment = require('../../../models/Comment');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');

// Mock dependencies
jest.mock('../../../models/Ticket');
jest.mock('../../../models/Comment');
jest.mock('../../../models/User');
jest.mock('../../../models/AuditLog');
jest.mock('../../../utils/logger');

describe('Client Ticket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AuditLog.create.mockResolvedValue({});
  });

  describe('createTicket', () => {
    it('should create ticket with auto-populated department from user', async () => {
      // Arrange
      const userId = 1;
      const mockUser = {
        id: 1,
        username: 'deptuser',
        department: 'Emergency Department',
        role: 'department',
      };
      const ticketData = {
        title: 'Test Ticket',
        description: 'Test description',
        reporter_phone: '+1234567890',
      };
      const mockTicket = {
        id: 1,
        ...ticketData,
        reporter_department: 'Emergency Department',
        reporter_id: userId,
        priority: 'unset',
        status: 'waiting_on_admin',
      };

      User.findById.mockResolvedValue(mockUser);
      Ticket.create.mockResolvedValue(mockTicket);

      // Act
      const result = await clientTicketService.createTicket(userId, ticketData);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(Ticket.create).toHaveBeenCalledWith({
        title: ticketData.title,
        description: ticketData.description,
        reporter_name: mockUser.username, // Auto-populated
        reporter_department: 'Emergency Department', // Auto-populated
        reporter_phone: ticketData.reporter_phone,
        reporter_id: userId, // Ownership enforcement
        priority: 'unset', // Forced
        status: 'waiting_on_admin', // Department-created tickets
      });
    });

    it('should force priority to unset regardless of input', async () => {
      // Arrange
      const userId = 1;
      const mockUser = { id: 1, department: 'Cardiology', role: 'department' };
      const ticketData = {
        title: 'Test',
        description: 'Test',
        priority: 'critical', // Department user tries to set priority
      };
      const mockTicket = { id: 1, ...ticketData, priority: 'unset', reporter_id: userId };

      User.findById.mockResolvedValue(mockUser);
      Ticket.create.mockResolvedValue(mockTicket);

      // Act
      await clientTicketService.createTicket(userId, ticketData);

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'unset' }));
    });

    it('should set status to waiting_on_admin for department-created tickets', async () => {
      // Arrange
      const userId = 1;
      const mockUser = { id: 1, department: 'Pharmacy', role: 'department' };
      const ticketData = { title: 'Test', description: 'Test' };
      const mockTicket = { id: 1, status: 'waiting_on_admin' };

      User.findById.mockResolvedValue(mockUser);
      Ticket.create.mockResolvedValue(mockTicket);

      // Act
      await clientTicketService.createTicket(userId, ticketData);

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'waiting_on_admin' })
      );
    });

    it('should set reporter_id to enforce ownership', async () => {
      // Arrange
      const userId = 42;
      const mockUser = { id: 42, department: 'Laboratory', role: 'department' };
      const ticketData = { title: 'Test', description: 'Test' };
      const mockTicket = { id: 1, reporter_id: 42 };

      User.findById.mockResolvedValue(mockUser);
      Ticket.create.mockResolvedValue(mockTicket);

      // Act
      await clientTicketService.createTicket(userId, ticketData);

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: userId }));
    });

    it('should throw error when user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        clientTicketService.createTicket(999, { title: 'Test', description: 'Test' })
      ).rejects.toThrow('User not found');
    });

    it('should throw error when user has no department set', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'user', department: null, role: 'department' };
      User.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        clientTicketService.createTicket(1, { title: 'Test', description: 'Test' })
      ).rejects.toThrow('Department not set for user');
    });

    it('should propagate database errors', async () => {
      // Arrange
      const mockUser = { id: 1, department: 'Test Dept', role: 'department' };
      const dbError = new Error('Database connection failed');

      User.findById.mockResolvedValue(mockUser);
      Ticket.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        clientTicketService.createTicket(1, { title: 'Test', description: 'Test' })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getDepartmentTickets', () => {
    it('should fetch tickets for a department with no filters', async () => {
      // Arrange
      const userId = 1;
      const department = 'Cardiology';
      const mockTickets = [
        { id: 1, title: 'Ticket 1', reporter_department: department },
        { id: 2, title: 'Ticket 2', reporter_department: department },
      ];

      Ticket.findByDepartment.mockResolvedValue(mockTickets);

      // Act
      const result = await clientTicketService.getDepartmentTickets(userId, department);

      // Assert
      expect(result).toEqual(mockTickets);
      expect(Ticket.findByDepartment).toHaveBeenCalledWith(department, {
        status: undefined,
        priority: undefined,
        search: undefined,
      });
    });

    it('should apply status filter', async () => {
      // Arrange
      const userId = 1;
      const department = 'Cardiology';
      const filters = { status: 'open' };
      const mockTickets = [{ id: 1, status: 'open', reporter_department: department }];

      Ticket.findByDepartment.mockResolvedValue(mockTickets);

      // Act
      await clientTicketService.getDepartmentTickets(userId, department, filters);

      // Assert
      expect(Ticket.findByDepartment).toHaveBeenCalledWith(department, {
        status: 'open',
        priority: undefined,
        search: undefined,
      });
    });

    it('should apply priority filter', async () => {
      // Arrange
      const userId = 1;
      const department = 'Cardiology';
      const filters = { priority: 'high' };

      Ticket.findByDepartment.mockResolvedValue([]);

      // Act
      await clientTicketService.getDepartmentTickets(userId, department, filters);

      // Assert
      expect(Ticket.findByDepartment).toHaveBeenCalledWith(department, {
        status: undefined,
        priority: 'high',
        search: undefined,
      });
    });

    it('should apply search filter', async () => {
      // Arrange
      const userId = 1;
      const department = 'Cardiology';
      const filters = { search: 'printer' };

      Ticket.findByDepartment.mockResolvedValue([]);

      // Act
      await clientTicketService.getDepartmentTickets(userId, department, filters);

      // Assert
      expect(Ticket.findByDepartment).toHaveBeenCalledWith(department, {
        status: undefined,
        priority: undefined,
        search: 'printer',
      });
    });

    it('should apply multiple filters simultaneously', async () => {
      // Arrange
      const userId = 1;
      const department = 'Cardiology';
      const filters = { status: 'open', priority: 'high', search: 'urgent' };

      Ticket.findByDepartment.mockResolvedValue([]);

      // Act
      await clientTicketService.getDepartmentTickets(userId, department, filters);

      // Assert
      expect(Ticket.findByDepartment).toHaveBeenCalledWith(department, {
        status: 'open',
        priority: 'high',
        search: 'urgent',
      });
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      Ticket.findByDepartment.mockRejectedValue(dbError);

      // Act & Assert
      await expect(clientTicketService.getDepartmentTickets(1, 'Cardiology')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getTicketById', () => {
    it('should return ticket when found', async () => {
      // Arrange
      const mockTicket = { id: 1, title: 'Test Ticket' };
      Ticket.findById.mockResolvedValue(mockTicket);

      // Act
      const result = await clientTicketService.getTicketById(1);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(Ticket.findById).toHaveBeenCalledWith(1);
    });

    it('should return undefined when ticket not found', async () => {
      // Arrange
      Ticket.findById.mockResolvedValue(undefined);

      // Act
      const result = await clientTicketService.getTicketById(999);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getVisibleComments', () => {
    it('should fetch public comments for department users', async () => {
      // Arrange
      const ticketId = 1;
      const mockComments = [
        { id: 1, content: 'Public comment', visibility_type: 'public' },
        { id: 2, content: 'Another public', visibility_type: 'public' },
      ];

      Comment.findVisibleByTicketId.mockResolvedValue(mockComments);

      // Act
      const result = await clientTicketService.getVisibleComments(ticketId);

      // Assert
      expect(result).toEqual(mockComments);
      expect(Comment.findVisibleByTicketId).toHaveBeenCalledWith(ticketId, 'department');
    });

    it('should not include internal comments (filtered by model)', async () => {
      // Arrange
      const ticketId = 1;
      const publicCommentsOnly = [{ id: 1, content: 'Public comment', visibility_type: 'public' }];

      Comment.findVisibleByTicketId.mockResolvedValue(publicCommentsOnly);

      // Act
      const result = await clientTicketService.getVisibleComments(ticketId);

      // Assert
      expect(result).toEqual(publicCommentsOnly);
      // Verify 'department' role passed (filters internal comments at model layer)
      expect(Comment.findVisibleByTicketId).toHaveBeenCalledWith(ticketId, 'department');
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      Comment.findVisibleByTicketId.mockRejectedValue(dbError);

      // Act & Assert
      await expect(clientTicketService.getVisibleComments(1)).rejects.toThrow('Database error');
    });
  });

  describe('addComment', () => {
    it('should create comment with forced public visibility', async () => {
      // Arrange
      const ticketId = 1;
      const userId = 5;
      const content = 'This is my comment';
      const mockTicket = { id: 1, status: 'open' };
      const mockComment = {
        id: 1,
        ticket_id: ticketId,
        user_id: userId,
        content,
        visibility_type: 'public',
      };

      Ticket.findById.mockResolvedValue(mockTicket);
      Comment.create.mockResolvedValue(mockComment);
      Ticket.update.mockResolvedValue({ id: 1, status: 'waiting_on_admin' });

      // Act
      const result = await clientTicketService.addComment(ticketId, userId, content);

      // Assert
      expect(result).toEqual(mockComment);
      expect(Comment.create).toHaveBeenCalledWith({
        ticket_id: ticketId,
        user_id: userId,
        content,
        visibility_type: 'public', // Forced for department users
      });
    });

    it('should auto-update ticket status to waiting_on_admin when ticket not closed', async () => {
      // Arrange
      const ticketId = 1;
      const mockTicket = { id: 1, status: 'in_progress' };
      const mockComment = { id: 1 };

      Ticket.findById.mockResolvedValue(mockTicket);
      Comment.create.mockResolvedValue(mockComment);
      Ticket.update.mockResolvedValue({ id: 1, status: 'waiting_on_admin' });

      // Act
      await clientTicketService.addComment(ticketId, 1, 'Comment');

      // Assert
      expect(Ticket.update).toHaveBeenCalledWith(ticketId, { status: 'waiting_on_admin' });
    });

    it('should not update status when ticket is closed', async () => {
      // Arrange
      const ticketId = 1;
      const mockTicket = { id: 1, status: 'closed' };
      const mockComment = { id: 1 };

      Ticket.findById.mockResolvedValue(mockTicket);
      Comment.create.mockResolvedValue(mockComment);

      // Act
      await clientTicketService.addComment(ticketId, 1, 'Comment');

      // Assert
      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should throw error when ticket not found', async () => {
      // Arrange
      Ticket.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(clientTicketService.addComment(999, 1, 'Comment')).rejects.toThrow(
        'Ticket not found'
      );
    });

    it('should propagate comment creation errors', async () => {
      // Arrange
      const mockTicket = { id: 1, status: 'open' };
      const dbError = new Error('Comment creation failed');

      Ticket.findById.mockResolvedValue(mockTicket);
      Comment.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(clientTicketService.addComment(1, 1, 'Comment')).rejects.toThrow(
        'Comment creation failed'
      );
    });
  });

  describe('updateTicketStatus', () => {
    it('should allow status change to waiting_on_admin', async () => {
      // Arrange
      const ticketId = 1;
      const newStatus = 'waiting_on_admin';
      const mockTicket = { id: 1, status: 'waiting_on_admin' };

      Ticket.update.mockResolvedValue(mockTicket);

      // Act
      const result = await clientTicketService.updateTicketStatus(ticketId, newStatus);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(Ticket.update).toHaveBeenCalledWith(ticketId, { status: 'waiting_on_admin' });
    });

    it('should allow status change to closed', async () => {
      // Arrange
      const ticketId = 1;
      const newStatus = 'closed';
      const mockTicket = { id: 1, status: 'closed' };

      Ticket.update.mockResolvedValue(mockTicket);

      // Act
      const result = await clientTicketService.updateTicketStatus(ticketId, newStatus);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(Ticket.update).toHaveBeenCalledWith(ticketId, { status: 'closed' });
    });

    it('should reject status change to open (admin-only)', async () => {
      // Arrange
      const ticketId = 1;
      const invalidStatus = 'open';

      // Act & Assert
      await expect(clientTicketService.updateTicketStatus(ticketId, invalidStatus)).rejects.toThrow(
        'Department users cannot set status to: open'
      );

      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should reject status change to in_progress (admin-only)', async () => {
      // Arrange
      const ticketId = 1;
      const invalidStatus = 'in_progress';

      // Act & Assert
      await expect(clientTicketService.updateTicketStatus(ticketId, invalidStatus)).rejects.toThrow(
        'Department users cannot set status to: in_progress'
      );

      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should reject status change to waiting_on_department (admin-only)', async () => {
      // Arrange
      const ticketId = 1;
      const invalidStatus = 'waiting_on_department';

      // Act & Assert
      await expect(clientTicketService.updateTicketStatus(ticketId, invalidStatus)).rejects.toThrow(
        'Department users cannot set status to: waiting_on_department'
      );

      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      Ticket.update.mockRejectedValue(dbError);

      // Act & Assert
      await expect(clientTicketService.updateTicketStatus(1, 'closed')).rejects.toThrow(
        'Database error'
      );
    });
  });
});
