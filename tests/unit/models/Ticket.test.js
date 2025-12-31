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
    it('should create ticket with all fields and default status=open', async () => {
      // Arrange
      const ticketData = createTicketData({ priority: 'high' });
      const mockTicket = {
        id: 1,
        ...ticketData,
        status: 'open',
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
        [
          ticketData.title,
          ticketData.description,
          ticketData.reporter_name,
          ticketData.reporter_email,
          ticketData.reporter_phone,
          ticketData.priority
        ]
      );
    });

    it('should create ticket with default priority=medium when not specified', async () => {
      // Arrange
      const ticketData = createTicketData();
      delete ticketData.priority; // Remove priority to test default
      const mockTicket = {
        id: 2,
        ...ticketData,
        priority: 'medium',
        status: 'open',
        created_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.create(ticketData);

      // Assert
      expect(result.priority).toBe('medium');
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['medium'])
      );
    });

    it('should create ticket with minimal required fields', async () => {
      // Arrange
      const minimalData = {
        title: 'Minimal Ticket',
        description: 'Description',
        reporter_name: 'John Doe',
        reporter_email: 'john@example.com',
        reporter_phone: null,
        priority: 'low'
      };
      const mockTicket = {
        id: 3,
        ...minimalData,
        status: 'open',
        created_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.create(minimalData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(3);
      expect(result.reporter_phone).toBeNull();
    });

    it('should use parameterized queries to prevent SQL injection', async () => {
      // Arrange
      const maliciousData = createTicketData({
        title: "'; DROP TABLE tickets; --"
      });
      const mockTicket = { id: 4, ...maliciousData, status: 'open' };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.create(maliciousData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.arrayContaining([maliciousData.title])
      );
      expect(pool.query).not.toHaveBeenCalledWith(
        expect.stringContaining("DROP TABLE"),
        expect.any(Array)
      );
    });

    it('should log slow query warning when query takes > 500ms', async () => {
      // Arrange
      const ticketData = createTicketData();
      const mockTicket = { id: 5, ...ticketData, status: 'open' };

      // Mock Date.now() to simulate slow query
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1600; // 600ms duration
      });

      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.create(ticketData);

      // Assert
      const logger = require('../../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.objectContaining({ duration: 600 })
      );

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const ticketData = createTicketData();
      const dbError = new Error('Database connection failed');
      dbError.code = '08006';
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.create(ticketData)).rejects.toThrow('Database connection failed');

      const logger = require('../../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error'),
        expect.objectContaining({
          error: 'Database connection failed',
          code: '08006'
        })
      );
    });

    it('should return ticket with RETURNING * clause', async () => {
      // Arrange
      const ticketData = createTicketData();
      const mockTicket = {
        id: 6,
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
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('updated_at');
      expect(result).toHaveProperty('status', 'open');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should log creation with reporter email and priority', async () => {
      // Arrange
      const ticketData = createTicketData();
      const mockTicket = { id: 7, ...ticketData, status: 'open' };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.create(ticketData);

      // Assert
      const logger = require('../../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating new ticket'),
        expect.objectContaining({
          reporterEmail: ticketData.reporter_email,
          priority: ticketData.priority
        })
      );
    });
  });

  describe('findById', () => {
    it('should return ticket with assigned user info when assignment exists', async () => {
      // Arrange
      const mockTicket = {
        id: 1,
        title: 'Test Ticket',
        description: 'Test description',
        status: 'open',
        priority: 'medium',
        reporter_name: 'John Doe',
        reporter_email: 'john@example.com',
        reporter_phone: '555-1234',
        assigned_to: 10,
        assigned_to_username: 'admin_user',
        created_at: new Date(),
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.findById(1);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(result.assigned_to_username).toBe('admin_user');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN users u ON t.assigned_to = u.id'),
        [1]
      );
    });

    it('should return ticket without assigned_to_username when not assigned', async () => {
      // Arrange
      const mockTicket = {
        id: 2,
        title: 'Unassigned Ticket',
        description: 'Test description',
        status: 'open',
        priority: 'high',
        reporter_name: 'Jane Doe',
        reporter_email: 'jane@example.com',
        reporter_phone: null,
        assigned_to: null,
        assigned_to_username: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.findById(2);

      // Assert
      expect(result).toEqual(mockTicket);
      expect(result.assigned_to).toBeNull();
      expect(result.assigned_to_username).toBeNull();
    });

    it('should return undefined when ticket not found', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Ticket.findById(999);

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT t.*, u.username as assigned_to_username'),
        [999]
      );
    });

    it('should use LEFT JOIN to handle null assigned_to', async () => {
      // Arrange
      const mockTicket = {
        id: 3,
        title: 'Test',
        assigned_to: null,
        assigned_to_username: null
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.findById(3);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN'),
        [3]
      );
      expect(pool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN'),
        expect.any(Array)
      );
    });

    it('should log slow query warning when query takes > 500ms', async () => {
      // Arrange
      const mockTicket = { id: 4, title: 'Test' };

      // Mock Date.now() to simulate slow query
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1700; // 700ms duration
      });

      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.findById(4);

      // Assert
      const logger = require('../../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.objectContaining({
          ticketId: 4,
          duration: 700
        })
      );

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      dbError.code = '57P01';
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.findById(1)).rejects.toThrow('Connection timeout');

      const logger = require('../../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error'),
        expect.objectContaining({
          ticketId: 1,
          error: 'Connection timeout',
          code: '57P01'
        })
      );
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Ticket.findById(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE t.id = $1'),
        [1]
      );
    });
  });

  describe('findAll', () => {
    it('should return all tickets when no filters provided', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Ticket 1', status: 'open', priority: 'high' },
        { id: 2, title: 'Ticket 2', status: 'in_progress', priority: 'medium' },
        { id: 3, title: 'Ticket 3', status: 'closed', priority: 'low' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll();

      // Assert
      expect(result).toEqual(mockTickets);
      expect(result).toHaveLength(3);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        []
      );
    });

    it('should filter by status only', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Ticket 1', status: 'open', priority: 'high' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({ status: 'open' });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND t.status = $1'),
        ['open']
      );
    });

    it('should filter by priority only', async () => {
      // Arrange
      const mockTickets = [
        { id: 2, title: 'Urgent Ticket', status: 'open', priority: 'critical' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({ priority: 'critical' });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND t.priority = $1'),
        ['critical']
      );
    });

    it('should filter by search term with ILIKE (case-insensitive)', async () => {
      // Arrange
      const mockTickets = [
        { id: 3, title: 'Login Issue', description: 'Cannot login' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({ search: 'login' });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['%login%']
      );
    });

    it('should search in both title and description', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Ticket.findAll({ search: 'error' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('t.title ILIKE'),
        ['%error%']
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('t.description ILIKE'),
        ['%error%']
      );
    });

    it('should combine multiple filters with AND', async () => {
      // Arrange
      const mockTickets = [
        { id: 4, title: 'Bug', status: 'open', priority: 'high' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll({
        status: 'open',
        priority: 'high',
        search: 'bug'
      });

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND t.status = $1'),
        ['open', 'high', '%bug%']
      );
    });

    it('should return empty array when no tickets match filters', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Ticket.findAll({ status: 'closed', priority: 'critical' });

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by created_at DESC (newest first)', async () => {
      // Arrange
      const mockTickets = [
        { id: 3, title: 'Newest', created_at: new Date('2025-01-03') },
        { id: 2, title: 'Middle', created_at: new Date('2025-01-02') },
        { id: 1, title: 'Oldest', created_at: new Date('2025-01-01') }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll();

      // Assert
      expect(result).toEqual(mockTickets);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY t.created_at DESC'),
        []
      );
    });

    it('should include assigned_to_username via LEFT JOIN', async () => {
      // Arrange
      const mockTickets = [
        { id: 1, title: 'Test', assigned_to: 5, assigned_to_username: 'admin' }
      ];
      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      const result = await Ticket.findAll();

      // Assert
      expect(result[0]).toHaveProperty('assigned_to_username');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN users u'),
        []
      );
    });

    it('should log slow query warning when query takes > 500ms', async () => {
      // Arrange
      const mockTickets = [{ id: 1 }];

      // Mock Date.now() to simulate slow query
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1800; // 800ms duration
      });

      pool.query.mockResolvedValue({ rows: mockTickets });

      // Act
      await Ticket.findAll({ status: 'open' });

      // Assert
      const logger = require('../../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.objectContaining({
          duration: 800,
          rowCount: 1
        })
      );

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Query execution failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.findAll()).rejects.toThrow('Query execution failed');

      const logger = require('../../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error'),
        expect.objectContaining({
          error: 'Query execution failed'
        })
      );
    });

    it('should handle special characters in search term safely', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Ticket.findAll({ search: "'; DROP TABLE tickets; --" });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE $'),
        expect.arrayContaining(["%'; DROP TABLE tickets; --%"])
      );
    });
  });

  describe('update', () => {
    it('should update ticket status only', async () => {
      // Arrange
      const mockTicket = {
        id: 1,
        title: 'Test',
        status: 'in_progress',
        priority: 'medium',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.update(1, { status: 'in_progress' });

      // Assert
      expect(result).toEqual(mockTicket);
      expect(result.status).toBe('in_progress');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['in_progress', 1]
      );
    });

    it('should update ticket priority only', async () => {
      // Arrange
      const mockTicket = {
        id: 2,
        title: 'Test',
        status: 'open',
        priority: 'critical',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.update(2, { priority: 'critical' });

      // Assert
      expect(result.priority).toBe('critical');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('priority = $1'),
        ['critical', 2]
      );
    });

    it('should update assigned_to to user ID', async () => {
      // Arrange
      const mockTicket = {
        id: 3,
        title: 'Test',
        assigned_to: 5,
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.update(3, { assigned_to: 5 });

      // Assert
      expect(result.assigned_to).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('assigned_to = $1'),
        [5, 3]
      );
    });

    it('should update assigned_to to null for unassignment', async () => {
      // Arrange
      const mockTicket = {
        id: 4,
        title: 'Test',
        assigned_to: null,
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.update(4, { assigned_to: null });

      // Assert
      expect(result.assigned_to).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('assigned_to = $1'),
        [null, 4]
      );
    });

    it('should update multiple fields simultaneously', async () => {
      // Arrange
      const mockTicket = {
        id: 5,
        status: 'closed',
        priority: 'low',
        assigned_to: 3,
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

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

    it('should always set updated_at to CURRENT_TIMESTAMP', async () => {
      // Arrange
      const mockTicket = {
        id: 6,
        status: 'open',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.update(6, { status: 'open' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });

    it('should handle empty updates object by only setting updated_at', async () => {
      // Arrange
      const mockTicket = {
        id: 7,
        title: 'Test',
        updated_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.update(7, {});

      // Assert
      expect(result).toEqual(mockTicket);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        [7]
      );
    });

    it('should use parameterized queries to prevent SQL injection', async () => {
      // Arrange
      const mockTicket = { id: 8, status: 'open' };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.update(8, { status: "'; DROP TABLE tickets; --" });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.arrayContaining(["'; DROP TABLE tickets; --", 8])
      );
    });

    it('should log slow query warning when query takes > 500ms', async () => {
      // Arrange
      const mockTicket = { id: 9, status: 'closed' };

      // Mock Date.now() to simulate slow query
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1900; // 900ms duration
      });

      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      await Ticket.update(9, { status: 'closed' });

      // Assert
      const logger = require('../../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.objectContaining({
          ticketId: 9,
          duration: 900
        })
      );

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Update failed');
      dbError.code = '23503'; // Foreign key violation
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Ticket.update(1, { status: 'closed' })).rejects.toThrow('Update failed');

      const logger = require('../../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error'),
        expect.objectContaining({
          ticketId: 1,
          error: 'Update failed',
          code: '23503'
        })
      );
    });

    it('should return updated ticket with RETURNING * clause', async () => {
      // Arrange
      const mockTicket = {
        id: 10,
        title: 'Updated',
        status: 'in_progress',
        priority: 'high',
        assigned_to: 2,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-02')
      };
      pool.query.mockResolvedValue({ rows: [mockTicket] });

      // Act
      const result = await Ticket.update(10, { status: 'in_progress', priority: 'high' });

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('updated_at');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });
  });
});
