/**
 * AuditLog Model Unit Tests
 *
 * Tests the AuditLog model in complete isolation with all dependencies mocked.
 * Covers all 3 static methods with success, failure, and edge cases.
 */

const AuditLog = require('../../../models/AuditLog');
const { createMockPool } = require('../../helpers/mocks');
const { createAuditLogData } = require('../../helpers/factories');

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/logger');

const pool = require('../../../config/database');

describe('AuditLog Model', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    Object.assign(pool, mockPool);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create audit log with all fields', async () => {
      // Arrange
      const auditLogData = createAuditLogData();
      const mockAuditLog = {
        id: 1,
        actor_id: auditLogData.actorId,
        action: auditLogData.action,
        target_type: auditLogData.targetType,
        target_id: auditLogData.targetId,
        details: JSON.stringify(auditLogData.details),
        ip_address: auditLogData.ipAddress,
        created_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockAuditLog] });

      // Act
      const result = await AuditLog.create(auditLogData);

      // Assert
      expect(result).toEqual(mockAuditLog);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          auditLogData.actorId,
          auditLogData.action,
          auditLogData.targetType,
          auditLogData.targetId,
          JSON.stringify(auditLogData.details),
          auditLogData.ipAddress,
        ])
      );
    });

    it('should stringify details object to JSON', async () => {
      // Arrange
      const detailsObject = {
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
      };
      const auditLogData = createAuditLogData({ details: detailsObject });
      const mockAuditLog = {
        id: 2,
        actor_id: auditLogData.actorId,
        action: auditLogData.action,
        target_type: auditLogData.targetType,
        target_id: auditLogData.targetId,
        details: JSON.stringify(detailsObject),
        ip_address: auditLogData.ipAddress,
        created_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockAuditLog] });

      // Act
      await AuditLog.create(auditLogData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(detailsObject)])
      );
    });

    it('should return created audit log with correct structure', async () => {
      // Arrange
      const auditLogData = createAuditLogData();
      const mockAuditLog = {
        id: 3,
        actor_id: auditLogData.actorId,
        action: auditLogData.action,
        target_type: auditLogData.targetType,
        target_id: auditLogData.targetId,
        details: JSON.stringify(auditLogData.details),
        ip_address: auditLogData.ipAddress,
        created_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockAuditLog] });

      // Act
      const result = await AuditLog.create(auditLogData);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('actor_id');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('target_type');
      expect(result).toHaveProperty('target_id');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('ip_address');
      expect(result).toHaveProperty('created_at');
    });

    it('should handle complex details object (nested objects, arrays)', async () => {
      // Arrange
      const complexDetails = {
        changes: {
          before: { status: 'active', role: 'admin' },
          after: { status: 'inactive', role: 'admin' },
        },
        metadata: ['field1', 'field2'],
        count: 42,
      };
      const auditLogData = createAuditLogData({ details: complexDetails });
      const mockAuditLog = {
        id: 4,
        actor_id: auditLogData.actorId,
        details: JSON.stringify(complexDetails),
        created_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockAuditLog] });

      // Act
      await AuditLog.create(auditLogData);

      // Assert
      const expectedJSON = JSON.stringify(complexDetails);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expectedJSON])
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const auditLogData = createAuditLogData();
      const dbError = new Error('Database insert failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(AuditLog.create(auditLogData)).rejects.toThrow('Database insert failed');
    });
  });

  describe('findByTarget', () => {
    it('should return audit logs for specific target (targetType + targetId)', async () => {
      // Arrange
      const mockAuditLogs = [
        {
          id: 1,
          actor_id: 5,
          action: 'UPDATE_USER',
          target_type: 'user',
          target_id: 10,
          details: '{"field":"value"}',
          created_at: new Date('2024-01-02'),
        },
        {
          id: 2,
          actor_id: 6,
          action: 'DELETE_USER',
          target_type: 'user',
          target_id: 10,
          details: '{"field":"value"}',
          created_at: new Date('2024-01-01'),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      const result = await AuditLog.findByTarget('user', 10);

      // Assert
      expect(result).toEqual(mockAuditLogs);
      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE target_type = $1 AND target_id = $2'),
        ['user', 10, 50]
      );
    });

    it('should use default limit of 50 when not provided', async () => {
      // Arrange
      const mockAuditLogs = [{ id: 1, target_type: 'ticket', target_id: 5 }];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      await AuditLog.findByTarget('ticket', 5);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $3'), [
        'ticket',
        5,
        50,
      ]);
    });

    it('should respect custom limit parameter', async () => {
      // Arrange
      const mockAuditLogs = [{ id: 1 }, { id: 2 }, { id: 3 }];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      await AuditLog.findByTarget('comment', 15, 10);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $3'), [
        'comment',
        15,
        10,
      ]);
    });

    it('should order results by created_at DESC (most recent first)', async () => {
      // Arrange
      const mockAuditLogs = [
        { id: 2, created_at: new Date('2024-01-02') },
        { id: 1, created_at: new Date('2024-01-01') },
      ];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      await AuditLog.findByTarget('user', 1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database query failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(AuditLog.findByTarget('user', 1)).rejects.toThrow('Database query failed');
    });
  });

  describe('findByActor', () => {
    it('should return audit logs for specific actor', async () => {
      // Arrange
      const mockAuditLogs = [
        {
          id: 1,
          actor_id: 5,
          action: 'CREATE_TICKET',
          target_type: 'ticket',
          target_id: 10,
          created_at: new Date('2024-01-02'),
        },
        {
          id: 2,
          actor_id: 5,
          action: 'UPDATE_TICKET',
          target_type: 'ticket',
          target_id: 10,
          created_at: new Date('2024-01-01'),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      const result = await AuditLog.findByActor(5);

      // Assert
      expect(result).toEqual(mockAuditLogs);
      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE actor_id = $1'),
        [5, 50]
      );
    });

    it('should use default limit of 50 when not provided', async () => {
      // Arrange
      const mockAuditLogs = [{ id: 1, actor_id: 3 }];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      await AuditLog.findByActor(3);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [3, 50]);
    });

    it('should respect custom limit parameter', async () => {
      // Arrange
      const mockAuditLogs = [{ id: 1 }, { id: 2 }];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      await AuditLog.findByActor(7, 20);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [7, 20]);
    });

    it('should order results by created_at DESC', async () => {
      // Arrange
      const mockAuditLogs = [
        { id: 3, created_at: new Date('2024-01-03') },
        { id: 2, created_at: new Date('2024-01-02') },
        { id: 1, created_at: new Date('2024-01-01') },
      ];
      pool.query.mockResolvedValue({ rows: mockAuditLogs });

      // Act
      await AuditLog.findByActor(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Query execution failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(AuditLog.findByActor(1)).rejects.toThrow('Query execution failed');
    });
  });
});
