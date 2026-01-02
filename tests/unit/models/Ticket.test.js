/**
 * Ticket Model Unit Tests
 *
 * Tests the Ticket model in complete isolation with all dependencies mocked.
 * Covers all 4 static methods with success, failure, and edge cases.
 */

const Ticket = require('../../../models/Ticket');
const { createMockPool } = require('../../helpers/mocks');
const { createTicketData } = require('../../helpers/factories');

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/logger');

const pool = require('../../../config/database');

describe('Ticket Model', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    Object.assign(pool, mockPool);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create ticket with all fields and return ticket object with status=open', async () => {
      // Arrange
      const ticketData = createTicketData();
      const mockTicket = {
        id: 1,
        ...ticketData,
        status: 'open',
        assigned_to: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.create(ticketData);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(result.status).toBe('open');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tickets'),
        expect.arrayContaining([
          ticketData.title,
          ticketData.description,
          ticketData.reporter_name,
          ticketData.reporter_email,
          ticketData.reporter_phone,
          ticketData.priority
        ])
      );
    });

    it('should create ticket with default priority=unset when not provided', async () => {
      // Arrange
      const ticketData = createTicketData({ priority: undefined });
      const mockTicket = {
        id: 2,
        ...ticketData,
        priority: 'unset',
        status: 'open',
        created_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.create(ticketData);

      // Assert
      expect(result.priority).toBe('unset');
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['unset'])
      );
    });

    it('should return ticket with correct structure including id and timestamps', async () => {
      // Arrange
      const ticketData = createTicketData();
      const now = new Date();
      const mockTicket = {
        id: 3,
        title: ticketData.title,
        description: ticketData.description,
        reporter_name: ticketData.reporter_name,
        reporter_email: ticketData.reporter_email,
        reporter_phone: ticketData.reporter_phone,
        priority: ticketData.priority,
        status: 'open',
        assigned_to: null,
        created_at: now,
        updated_at: now
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.create(ticketData);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('updated_at');
    });

    it('should use parameterized query with correct parameters', async () => {
      // Arrange
      const ticketData = createTicketData({
        title: 'Test Ticket',
        description: 'Test Description',
        reporter_name: 'John Doe',
        reporter_email: 'john@example.com',
        reporter_phone: '555-1234',
        priority: 'high'
      });
      const mockTicket = { id: 4, ...ticketData, status: 'open', created_at: new Date() };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.create(ticketData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1, $2, $3, $4, $5, $6'),
        ['Test Ticket', 'Test Description', 'John Doe', 'john@example.com', '555-1234', 'high']
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const ticketData = createTicketData();
      const dbError = new Error('Database connection failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.create(ticketData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    it('should return ticket with assigned_to_username when ticket exists', async () => {
      // Arrange
      const mockTicket = {
        id: 1,
        title: 'Test Ticket',
        description: 'Test Description',
        status: 'open',
        priority: 'medium',
        reporter_name: 'John Doe',
        reporter_email: 'john@example.com',
        reporter_phone: '555-1234',
        assigned_to: 5,
        assigned_to_username: 'admin',
        created_at: new Date(),
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.findById(1);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(result.assigned_to_username).toBe('admin');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('should execute LEFT JOIN with users table', async () => {
      // Arrange
      const mockTicket = {
        id: 2,
        title: 'Unassigned Ticket',
        assigned_to: null,
        assigned_to_username: null
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.findById(2);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN users'),
        [2]
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('u.username as assigned_to_username'),
        expect.any(Array)
      );
    });

    it('should return undefined when ticket does not exist', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Ticket.findById(999);

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [999]
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database query failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.findById(1)).rejects.toThrow('Database query failed');
    });
  });

  describe('findAll', () => {
    it('should return all tickets when no filters provided', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Ticket 1', status: 'open', priority: 'high' },
        { id: 2, title: 'Ticket 2', status: 'closed', priority: 'low' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({});

      // Assert
      expect(result).toEqual(mockTickets);
      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        []
      );
    });

    it('should filter by status when status filter provided', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Open Ticket', status: 'open' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({ status: 'open' });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('t.status = $1'),
        ['open']
      );
    });

    it('should filter by priority when priority filter provided', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'High Priority', priority: 'high' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({ priority: 'high' });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('t.priority = $1'),
        ['high']
      );
    });

    it('should filter by search term (ILIKE on title and description)', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Bug in login', description: 'User cannot login' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({ search: 'login' });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('t.title ILIKE $1 OR t.description ILIKE $1'),
        ['%login%']
      );
    });

    it('should combine multiple filters (status + priority + search)', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Critical Bug', status: 'open', priority: 'critical' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({
        status: 'open',
        priority: 'critical',
        search: 'bug'
      });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('t.status = $1'),
        ['open', 'critical', '%bug%']
      );
    });

    it('should return empty array when no tickets match', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Ticket.findAll({ status: 'closed' });

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by created_at DESC', async () => {
      // Arrange
      const mockTickets = [
        { id: 2, title: 'Newer', created_at: new Date('2024-01-02') },
        { id: 1, title: 'Older', created_at: new Date('2024-01-01') }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      await Ticket.findAll({});

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY t.created_at DESC'),
        []
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database connection lost');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.findAll({})).rejects.toThrow('Database connection lost');
    });
  });

  describe('update', () => {
    it('should update status only when only status provided', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 1,
        title: 'Test Ticket',
        status: 'in_progress',
        priority: 'medium',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUpdatedTicket] });

      // Act
      const result = await Ticket.update(1, { status: 'in_progress' });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(result.status).toBe('in_progress');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['in_progress', 1]
      );
    });

    it('should update priority only when only priority provided', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 2,
        title: 'Test Ticket',
        status: 'open',
        priority: 'critical',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUpdatedTicket] });

      // Act
      const result = await Ticket.update(2, { priority: 'critical' });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(result.priority).toBe('critical');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('priority = $1'),
        ['critical', 2]
      );
    });

    it('should update assigned_to when provided', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 3,
        title: 'Test Ticket',
        assigned_to: 5,
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUpdatedTicket] });

      // Act
      const result = await Ticket.update(3, { assigned_to: 5 });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(result.assigned_to).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('assigned_to = $1'),
        [5, 3]
      );
    });

    it('should update assigned_to to null when null provided (unassign)', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 4,
        title: 'Test Ticket',
        assigned_to: null,
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUpdatedTicket] });

      // Act
      const result = await Ticket.update(4, { assigned_to: null });

      // Assert
      expect(result).toEqual(mockUpdatedTicket);
      expect(result.assigned_to).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('assigned_to = $1'),
        [null, 4]
      );
    });

    it('should update multiple fields simultaneously', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 5,
        status: 'closed',
        priority: 'low',
        assigned_to: 3,
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUpdatedTicket] });

      // Act
      const result = await Ticket.update(5, {
        status: 'closed',
        priority: 'low',
        assigned_to: 3
      });

      // Assert
      expect(result.status).toBe('closed');
      expect(result.priority).toBe('low');
      expect(result.assigned_to).toBe(3);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['closed', 'low', 3, 5]
      );
    });

    it('should always update updated_at timestamp', async () => {
      // Arrange
      const mockUpdatedTicket = {
        id: 6,
        status: 'open',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockUpdatedTicket] });

      // Act
      await Ticket.update(6, { status: 'open' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Update failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.update(1, { status: 'closed' })).rejects.toThrow('Update failed');
    });
  });
});
