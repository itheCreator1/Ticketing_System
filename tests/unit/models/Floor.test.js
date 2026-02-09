/**
 * Floor Model Unit Tests
 *
 * Tests the Floor model in complete isolation with all dependencies mocked.
 * Covers all 8 static methods with success, failure, and edge cases.
 *
 * Test Coverage:
 * - findAll() - 8 tests
 * - findAllForAdmin() - 5 tests
 * - findById() - 6 tests
 * - findByName() - 5 tests
 * - create() - 9 tests
 * - update() - 11 tests
 * - deactivate() - 7 tests
 * - reactivate() - 4 tests
 * - countDepartments() - 4 tests
 * Total: 59 tests
 */

const Floor = require('../../../models/Floor');
const { createMockPool } = require('../../helpers/mocks');

// Mock dependencies
jest.mock('../../../config/database');

const pool = require('../../../config/database');

describe('Floor Model', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    Object.assign(pool, mockPool);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active floors when includeSystem=false', async () => {
      // Arrange
      const mockFloors = [
        {
          id: 1,
          name: 'Ground Floor',
          sort_order: 0,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: '1st Floor',
          sort_order: 1,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockFloors });

      // Act
      const result = await Floor.findAll(false);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeValidFloor();
      expect(result[0].name).toBe('Ground Floor');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE active = true AND is_system = false')
      );
    });

    it('should exclude system floors when includeSystem=false', async () => {
      // Arrange
      const mockFloors = [
        {
          id: 1,
          name: 'Ground Floor',
          sort_order: 0,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockFloors });

      // Act
      const result = await Floor.findAll(false);

      // Assert
      expect(result).not.toContainEqual(expect.objectContaining({ is_system: true }));
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('is_system = false'));
    });

    it('should include system floors when includeSystem=true', async () => {
      // Arrange
      const mockFloors = [
        {
          id: 1,
          name: 'Ground Floor',
          sort_order: 0,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'System Floor',
          sort_order: 999,
          is_system: true,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockFloors });

      // Act
      const result = await Floor.findAll(true);

      // Assert
      expect(result).toHaveLength(2);
      expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('is_system = false'));
    });

    it('should only return active floors', async () => {
      // Arrange
      const mockFloors = [
        {
          id: 1,
          name: 'Ground Floor',
          sort_order: 0,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockFloors });

      // Act
      const result = await Floor.findAll(false);

      // Assert
      expect(result.every((floor) => floor.active === true)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE active = true'));
    });

    it('should order floors by sort_order then name', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Floor.findAll(false);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY sort_order, name'));
    });

    it('should handle empty result set', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.findAll(false);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.findAll(false)).rejects.toThrow('Database connection failed');
    });

    it('should accept boolean parameter for includeSystem', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Floor.findAll(true);
      const call1 = pool.query.mock.calls[0][0];

      pool.query.mockClear();
      pool.query.mockResolvedValue({ rows: [] });
      await Floor.findAll(false);
      const call2 = pool.query.mock.calls[0][0];

      // Assert
      expect(call1).not.toContain('is_system = false');
      expect(call2).toContain('is_system = false');
    });
  });

  describe('findAllForAdmin', () => {
    it('should return all floors including inactive', async () => {
      // Arrange
      const mockFloors = [
        {
          id: 1,
          name: 'Ground Floor',
          sort_order: 0,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Old Floor',
          sort_order: 10,
          is_system: false,
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockFloors });

      // Act
      const result = await Floor.findAllForAdmin();

      // Assert
      expect(result).toHaveLength(2);
      expect(result.some((floor) => floor.active === false)).toBe(true);
    });

    it('should include system floors', async () => {
      // Arrange
      const mockFloors = [
        {
          id: 1,
          name: 'Ground Floor',
          sort_order: 0,
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'System Floor',
          sort_order: 999,
          is_system: true,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockFloors });

      // Act
      const result = await Floor.findAllForAdmin();

      // Assert
      expect(result.some((floor) => floor.is_system === true)).toBe(true);
    });

    it('should order by is_system DESC, active DESC, sort_order, name', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Floor.findAllForAdmin();

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY is_system DESC, active DESC, sort_order, name')
      );
    });

    it('should return empty array when no floors', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.findAllForAdmin();

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.findAllForAdmin()).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return floor by valid ID', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.findById(1);

      // Assert
      expect(result).toBeValidFloor();
      expect(result.name).toBe('Ground Floor');
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM floors WHERE id = $1', [1]);
    });

    it('should return undefined for non-existent ID', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.findById(999);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return inactive floor', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Old Floor',
        sort_order: 10,
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.findById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.active).toBe(false);
    });

    it('should return system floor', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'System Floor',
        sort_order: 999,
        is_system: true,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.findById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.is_system).toBe(true);
    });

    it('should work with positive integer IDs', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Floor.findById(42);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [42]);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('findByName', () => {
    it('should return floor by exact name match', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.findByName('Ground Floor');

      // Assert
      expect(result).toBeValidFloor();
      expect(result.name).toBe('Ground Floor');
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM floors WHERE name = $1', [
        'Ground Floor',
      ]);
    });

    it('should return undefined for non-existent name', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.findByName('NonExistent');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should be case-sensitive', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Floor.findByName('ground floor');

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['ground floor']);
    });

    it('should handle special characters in name', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: '1st & 2nd Floor',
        sort_order: 1,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.findByName('1st & 2nd Floor');

      // Assert
      expect(result.name).toBe('1st & 2nd Floor');
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.findByName('Ground Floor')).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create new floor with valid data', async () => {
      // Arrange
      const floorData = { name: '2nd Floor', sort_order: 2 };
      const mockFloor = {
        id: 1,
        name: '2nd Floor',
        sort_order: 2,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.create(floorData);

      // Assert
      expect(result).toBeValidFloor();
      expect(result.name).toBe('2nd Floor');
      expect(result.sort_order).toBe(2);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO floors'), [
        '2nd Floor',
        2,
      ]);
    });

    it('should set is_system=false for non-system floors', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Test Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.create({ name: 'Test Floor', sort_order: 0 });

      // Assert
      expect(result.is_system).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_system'),
        expect.any(Array)
      );
    });

    it('should set active=true by default', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Test Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.create({ name: 'Test Floor', sort_order: 0 });

      // Assert
      expect(result.active).toBe(true);
    });

    it('should use default sort_order=0 when not provided', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Test Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const _result = await Floor.create({ name: 'Test Floor' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['Test Floor', 0]);
    });

    it('should prevent duplicate names via UNIQUE constraint', async () => {
      // Arrange
      const dbError = new Error('duplicate key value violates unique constraint');
      dbError.code = '23505';
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.create({ name: 'Ground Floor', sort_order: 0 })).rejects.toThrow(
        'duplicate key value'
      );
    });

    it('should handle names with whitespace', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor Extended',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.create({ name: 'Ground Floor Extended', sort_order: 0 });

      // Assert
      expect(result.name).toBe('Ground Floor Extended');
    });

    it('should return floor with RETURNING clause', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Test Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.create({ name: 'Test Floor', sort_order: 0 });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
      expect(result).toBeDefined();
    });

    it('should accept optional client parameter for transaction support', async () => {
      // Arrange
      const mockClient = createMockPool();
      const mockFloor = {
        id: 1,
        name: 'Test Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockClient.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.create({ name: 'Test Floor', sort_order: 0 }, mockClient);

      // Assert
      expect(result).toBeValidFloor();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO floors'),
        expect.any(Array)
      );
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.create({ name: 'Test Floor', sort_order: 0 })).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('update', () => {
    it('should update non-system floor name', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Updated Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { name: 'Updated Floor' });

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Floor');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $'),
        expect.any(Array)
      );
    });

    it('should update non-system floor sort_order', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 5,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { sort_order: 5 });

      // Assert
      expect(result.sort_order).toBe(5);
    });

    it('should update non-system floor active status', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { active: false });

      // Assert
      expect(result.active).toBe(false);
    });

    it('should prevent updating system floor', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.update(1, { name: 'New Name' });

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_system = false'),
        expect.any(Array)
      );
    });

    it('should return updated floor with RETURNING', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Updated',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { name: 'Updated' });

      // Assert
      expect(result).toBeDefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should handle partial updates - only name', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'New Name',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { name: 'New Name' });

      // Assert
      expect(result.name).toBe('New Name');
    });

    it('should handle partial updates - only sort_order', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 5,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { sort_order: 5 });

      // Assert
      expect(result.sort_order).toBe(5);
    });

    it('should update updated_at timestamp', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      await Floor.update(1, { name: 'Updated' });

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should return undefined for non-existent ID', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.update(999, { name: 'New Name' });

      // Assert
      expect(result).toBeUndefined();
    });

    it('should accept optional client parameter for transaction support', async () => {
      // Arrange
      const mockClient = createMockPool();
      const mockFloor = {
        id: 1,
        name: 'Updated Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockClient.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.update(1, { name: 'Updated Floor' }, mockClient);

      // Assert
      expect(result).toBeValidFloor();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE floors'),
        expect.any(Array)
      );
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.update(1, { name: 'New Name' })).rejects.toThrow('Database error');
    });
  });

  describe('deactivate', () => {
    it('should soft-delete non-system floor', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.deactivate(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.active).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET active = false'), [1]);
    });

    it('should prevent deactivating system floor', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.deactivate(1);

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('is_system = false'), [1]);
    });

    it('should return deactivated floor with RETURNING', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.deactivate(1);

      // Assert
      expect(result).toBeValidFloor();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should return undefined for non-existent ID', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.deactivate(999);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should update updated_at timestamp', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      await Floor.deactivate(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.deactivate(1)).rejects.toThrow('Database error');
    });
  });

  describe('reactivate', () => {
    it('should reactivate deactivated floor', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.reactivate(1);

      // Assert
      expect(result).toBeValidFloor();
      expect(result.active).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET active = true'), [1]);
    });

    it('should return reactivated floor with RETURNING', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      const result = await Floor.reactivate(1);

      // Assert
      expect(result).toBeValidFloor();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should prevent reactivating system floor', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Floor.reactivate(1);

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('is_system = false'), [1]);
    });

    it('should update updated_at timestamp on reactivation', async () => {
      // Arrange
      const mockFloor = {
        id: 1,
        name: 'Ground Floor',
        sort_order: 0,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockFloor] });

      // Act
      await Floor.reactivate(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.reactivate(1)).rejects.toThrow('Database error');
    });
  });

  describe('countDepartments', () => {
    it('should count departments assigned to floor', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '5' }] });

      // Act
      const result = await Floor.countDepartments('Ground Floor');

      // Assert
      expect(result).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM departments WHERE floor = $1',
        ['Ground Floor']
      );
    });

    it('should return 0 for floor with no departments', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '0' }] });

      // Act
      const result = await Floor.countDepartments('New Floor');

      // Assert
      expect(result).toBe(0);
    });

    it('should return integer count', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '10' }] });

      // Act
      const result = await Floor.countDepartments('Ground Floor');

      // Assert
      expect(typeof result).toBe('number');
      expect(result).toBe(10);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Floor.countDepartments('Ground Floor')).rejects.toThrow('Database error');
    });
  });
});
