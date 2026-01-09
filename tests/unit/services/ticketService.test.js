/**
 * TicketService Unit Tests
 *
 * Tests the TicketService in complete isolation with all dependencies mocked.
 * Covers all 4 methods with success, failure, and edge cases.
 */

const ticketService = require('../../../services/ticketService');
const Ticket = require('../../../models/Ticket');
const User = require('../../../models/User');
const { createTicketData, createUserData } = require('../../helpers/factories');

// Mock dependencies
jest.mock('../../../models/Ticket');
jest.mock('../../../models/User');
jest.mock('../../../utils/logger');

describe('TicketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create ticket and return created ticket', async () => {
      // Arrange
      const ticketData = createTicketData();
      const mockCreatedTicket = {
        id: 1,
        ...ticketData,
        status: 'open',
        created_at: new Date(),
        updated_at: new Date()
      };
      Ticket.create.mockResolvedValue(mockCreatedTicket);

      // Act
      const result = await ticketService.createTicket(ticketData);

      // Assert
      expect(result).toEqual(mockCreatedTicket);
      expect(Ticket.create).toHaveBeenCalledWith(ticketData);
      expect(Ticket.create).toHaveBeenCalledTimes(1);
    });

    it('should call Ticket.create with correct data', async () => {
      // Arrange
      const ticketData = createTicketData({
        title: 'System Error',
        description: 'Application crashes on startup',
        reporter_name: 'John Doe',
        reporter_department: 'IT Support',
        reporter_phone: '555-1234',
        priority: 'critical'
      });
      const mockCreatedTicket = { id: 2, ...ticketData, status: 'open' };
      Ticket.create.mockResolvedValue(mockCreatedTicket);

      // Act
      await ticketService.createTicket(ticketData);

      // Assert
      expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'System Error',
        description: 'Application crashes on startup',
        reporter_name: 'John Doe',
        reporter_department: 'IT Support',
        reporter_phone: '555-1234',
        priority: 'critical'
      }));
    });

    it('should throw error when Ticket.create fails', async () => {
      // Arrange
      const ticketData = createTicketData();
      const dbError = new Error('Database insert failed');
      Ticket.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(ticketService.createTicket(ticketData)).rejects.toThrow('Database insert failed');
      expect(Ticket.create).toHaveBeenCalledWith(ticketData);
    });
  });

  describe('getTicketById', () => {
    it('should return ticket when found', async () => {
      // Arrange
      const mockTicket = {
        id: 1,
        title: 'Test Ticket',
        status: 'open',
        priority: 'medium',
        assigned_to: 5,
        assigned_to_username: 'admin'
      };
      Ticket.findById.mockResolvedValue(mockTicket);

      // Act
      const result = await ticketService.getTicketById(1);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(Ticket.findById).toHaveBeenCalledWith(1);
      expect(Ticket.findById).toHaveBeenCalledTimes(1);
    });

    it('should call Ticket.findById with correct id', async () => {
      // Arrange
      Ticket.findById.mockResolvedValue({ id: 42 });

      // Act
      await ticketService.getTicketById(42);

      // Assert
      expect(Ticket.findById).toHaveBeenCalledWith(42);
    });

    it('should return undefined when ticket not found', async () => {
      // Arrange
      Ticket.findById.mockResolvedValue(undefined);

      // Act
      const result = await ticketService.getTicketById(999);

      // Assert
      expect(result).toBeUndefined();
      expect(Ticket.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('getAllTickets', () => {
    it('should return all tickets when no filters provided', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Ticket 1', status: 'open' },
        { id: 2, title: 'Ticket 2', status: 'closed' }
      ];
      Ticket.findAll.mockResolvedValue(mockTickets);

      // Act
      const result = await ticketService.getAllTickets({});

      // Assert
      expect(result).toEqual(mockTickets);
      expect(Ticket.findAll).toHaveBeenCalledWith({
        status: undefined,
        priority: undefined,
        search: undefined
      });
    });

    it('should pass status filter to Ticket.findAll', async () => {
      // Arrange
      const mockTickets = [{ id: 1, status: 'open' }];
      Ticket.findAll.mockResolvedValue(mockTickets);

      // Act
      await ticketService.getAllTickets({ status: 'open' });

      // Assert
      expect(Ticket.findAll).toHaveBeenCalledWith({
        status: 'open',
        priority: undefined,
        search: undefined
      });
    });

    it('should pass priority filter to Ticket.findAll', async () => {
      // Arrange
      const mockTickets = [{ id: 1, priority: 'high' }];
      Ticket.findAll.mockResolvedValue(mockTickets);

      // Act
      await ticketService.getAllTickets({ priority: 'high' });

      // Assert
      expect(Ticket.findAll).toHaveBeenCalledWith({
        status: undefined,
        priority: 'high',
        search: undefined
      });
    });

    it('should pass search filter to Ticket.findAll', async () => {
      // Arrange
      const mockTickets = [{ id: 1, title: 'Bug report' }];
      Ticket.findAll.mockResolvedValue(mockTickets);

      // Act
      await ticketService.getAllTickets({ search: 'bug' });

      // Assert
      expect(Ticket.findAll).toHaveBeenCalledWith({
        status: undefined,
        priority: undefined,
        search: 'bug'
      });
    });

    it('should clean filters (remove undefined values)', async () => {
      // Arrange
      Ticket.findAll.mockResolvedValue([]);

      // Act
      await ticketService.getAllTickets({
        status: 'open',
        priority: undefined,
        search: undefined
      });

      // Assert
      expect(Ticket.findAll).toHaveBeenCalledWith({
        status: 'open',
        priority: undefined,
        search: undefined
      });
    });

    it('should handle empty filters object', async () => {
      // Arrange
      Ticket.findAll.mockResolvedValue([]);

      // Act
      await ticketService.getAllTickets({});

      // Assert
      expect(Ticket.findAll).toHaveBeenCalledWith({
        status: undefined,
        priority: undefined,
        search: undefined
      });
    });
  });

  describe('updateTicket', () => {
    it('should update ticket status successfully', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 1,
        title: 'Test Ticket',
        status: 'closed',
        priority: 'medium',
        updated_at: new Date()
      };
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      const result = await ticketService.updateTicket(1, { status: 'closed' });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(Ticket.update).toHaveBeenCalledWith(1, { status: 'closed' });
    });

    it('should update ticket priority successfully', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 2,
        title: 'Test Ticket',
        priority: 'critical',
        updated_at: new Date()
      };
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      const result = await ticketService.updateTicket(2, { priority: 'critical' });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(Ticket.update).toHaveBeenCalledWith(2, { priority: 'critical' });
    });

    it('should assign ticket to active user (validates user exists and is active)', async () => {
      // Arrange
      const mockUser = createUserData({ id: 5, status: 'active' });
      const mockUpdatedTicket = {
        id: 3,
        assigned_to: 5,
        updated_at: new Date()
      };
      User.findById.mockResolvedValue(mockUser);
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      const result = await ticketService.updateTicket(3, { assigned_to: 5 });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(User.findById).toHaveBeenCalledWith(5);
      expect(Ticket.update).toHaveBeenCalledWith(3, { assigned_to: 5 });
    });

    it('should unassign ticket when assigned_to is null', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 4,
        assigned_to: null,
        updated_at: new Date()
      };
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      const result = await ticketService.updateTicket(4, { assigned_to: null });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(User.findById).not.toHaveBeenCalled();
      expect(Ticket.update).toHaveBeenCalledWith(4, { assigned_to: null });
    });

    it('should unassign ticket when assigned_to is empty string', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 5,
        assigned_to: null,
        updated_at: new Date()
      };
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      const result = await ticketService.updateTicket(5, { assigned_to: '' });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(User.findById).not.toHaveBeenCalled();
      expect(Ticket.update).toHaveBeenCalledWith(5, { assigned_to: null });
    });

    it('should throw error when assigning to non-existent user', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(ticketService.updateTicket(6, { assigned_to: 999 }))
        .rejects.toThrow('Cannot assign to inactive or non-existent user');
      expect(User.findById).toHaveBeenCalledWith(999);
      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should throw error when assigning to inactive user', async () => {
      // Arrange
      const inactiveUser = createUserData({ id: 7, status: 'inactive' });
      User.findById.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(ticketService.updateTicket(7, { assigned_to: 7 }))
        .rejects.toThrow('Cannot assign to inactive or non-existent user');
      expect(User.findById).toHaveBeenCalledWith(7);
      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should throw error when assigning to deleted user', async () => {
      // Arrange
      const deletedUser = createUserData({ id: 8, status: 'deleted' });
      User.findById.mockResolvedValue(deletedUser);

      // Act & Assert
      await expect(ticketService.updateTicket(8, { assigned_to: 8 }))
        .rejects.toThrow('Cannot assign to inactive or non-existent user');
      expect(User.findById).toHaveBeenCalledWith(8);
      expect(Ticket.update).not.toHaveBeenCalled();
    });

    it('should update multiple fields simultaneously', async () => {
      // Arrange
      const mockUser = createUserData({ id: 9, status: 'active' });
      const mockUpdatedTicket = {
        id: 9,
        status: 'in_progress',
        priority: 'high',
        assigned_to: 9,
        updated_at: new Date()
      };
      User.findById.mockResolvedValue(mockUser);
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      const result = await ticketService.updateTicket(9, {
        status: 'in_progress',
        priority: 'high',
        assigned_to: 9
      });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(User.findById).toHaveBeenCalledWith(9);
      expect(Ticket.update).toHaveBeenCalledWith(9, {
        status: 'in_progress',
        priority: 'high',
        assigned_to: 9
      });
    });

    it('should call User.findById to validate assigned user', async () => {
      // Arrange
      const mockUser = createUserData({ id: 10, status: 'active', username: 'testuser' });
      const mockUpdatedTicket = { id: 10, assigned_to: 10 };
      User.findById.mockResolvedValue(mockUser);
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      await ticketService.updateTicket(10, { assigned_to: 10 });

      // Assert
      expect(User.findById).toHaveBeenCalledWith(10);
      expect(User.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw error when Ticket.update fails', async () => {
      // Arrange
      const dbError = new Error('Database update failed');
      Ticket.update.mockRejectedValue(dbError);

      // Act & Assert
      await expect(ticketService.updateTicket(11, { status: 'closed' }))
        .rejects.toThrow('Database update failed');
      expect(Ticket.update).toHaveBeenCalledWith(11, { status: 'closed' });
    });

    it('should not validate user when only updating status and priority', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 12,
        status: 'closed',
        priority: 'low',
        updated_at: new Date()
      };
      Ticket.update.mockResolvedValue(mockUpdatedTicket);

      // Act
      await ticketService.updateTicket(12, {
        status: 'closed',
        priority: 'low'
      });

      // Assert
      expect(User.findById).not.toHaveBeenCalled();
      expect(Ticket.update).toHaveBeenCalledWith(12, {
        status: 'closed',
        priority: 'low'
      });
    });
  });
});
