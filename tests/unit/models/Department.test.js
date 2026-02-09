/**
 * Department Model Unit Tests
 *
 * Tests the Department model in complete isolation with all dependencies mocked.
 * Covers all 11 static methods with success, failure, and edge cases.
 *
 * Test Coverage:
 * - findAll() - 8 tests
 * - findAllForAdmin() - 5 tests
 * - findById() - 6 tests
 * - findByName() - 5 tests
 * - create() - 8 tests
 * - update() - 10 tests
 * - deactivate() - 6 tests
 * - countUsers() - 4 tests
 * - countTickets() - 4 tests
 * - getUsers() - 3 tests
 * - getAvailableUsers() - 3 tests
 * Total: 62 tests
 */

const Department = require('../../../models/Department');
const { createMockPool } = require('../../helpers/mocks');

// Mock dependencies
jest.mock('../../../config/database');

const pool = require('../../../config/database');

describe('Department Model', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    Object.assign(pool, mockPool);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active departments when includeSystem=false', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          description: 'Heart care',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Radiology',
          description: 'Imaging',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAll(false);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeValidDepartment();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE active = true AND is_system = false')
      );
    });

    it('should exclude Internal department when includeSystem=false', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          description: 'Heart care',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAll(false);

      // Assert
      expect(result).not.toContainEqual(expect.objectContaining({ name: 'Internal' }));
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('is_system = false'));
    });

    it('should include Internal department when includeSystem=true', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          description: 'Heart care',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Internal',
          description: 'Admin only',
          is_system: true,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAll(true);

      // Assert
      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE active = true ORDER BY name')
      );
      expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('is_system = false'));
    });

    it('should only return active departments', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          description: 'Heart care',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAll(false);

      // Assert
      expect(result.every((dept) => dept.active === true)).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE active = true'));
    });

    it('should exclude soft-deleted departments', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          description: 'Heart care',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAll(false);

      // Assert
      expect(result).not.toContainEqual(expect.objectContaining({ active: false }));
    });

    it('should order departments alphabetically by name', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          description: 'Heart care',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Radiology',
          description: 'Imaging',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      await Department.findAll(false);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY name'));
    });

    it('should handle empty result set', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.findAll(false);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.findAll(false)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findAllForAdmin', () => {
    it('should return all departments including inactive', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Old Dept',
          is_system: false,
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAllForAdmin();

      // Assert
      expect(result).toHaveLength(2);
      expect(result.some((dept) => dept.active === false)).toBe(true);
    });

    it('should include system departments', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Cardiology',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Internal',
          is_system: true,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAllForAdmin();

      // Assert
      expect(result.some((dept) => dept.is_system === true)).toBe(true);
    });

    it('should include soft-deleted departments', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: 1,
          name: 'Active Dept',
          is_system: false,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Deleted Dept',
          is_system: false,
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockDepartments });

      // Act
      const result = await Department.findAllForAdmin();

      // Assert
      expect(result).toHaveLength(2);
      expect(result.some((dept) => dept.active === false)).toBe(true);
    });

    it('should order departments by is_system DESC, active DESC, name', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Department.findAllForAdmin();

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY is_system DESC, active DESC, name')
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.findAllForAdmin()).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return department by valid ID', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        description: 'Heart care',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.findById(1);

      // Assert
      expect(result).toBeValidDepartment();
      expect(result.name).toBe('Cardiology');
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM departments WHERE id = $1', [1]);
    });

    it('should return undefined for non-existent ID', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.findById(999);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return soft-deleted department', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Old Dept',
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.findById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.active).toBe(false);
    });

    it('should return system department', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Internal',
        is_system: true,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.findById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.is_system).toBe(true);
    });

    it('should work with positive integer IDs', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Department.findById(42);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [42]);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('findByName', () => {
    it('should return department by exact name match', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.findByName('Cardiology');

      // Assert
      expect(result).toBeValidDepartment();
      expect(result.name).toBe('Cardiology');
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM departments WHERE name = $1', [
        'Cardiology',
      ]);
    });

    it('should return undefined for non-existent name', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.findByName('NonExistent');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should be case-sensitive', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Department.findByName('cardiology');

      // Assert
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['cardiology']);
    });

    it('should handle special characters in name', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'IT & Support',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.findByName('IT & Support');

      // Assert
      expect(result.name).toBe('IT & Support');
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.findByName('Cardiology')).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create new department with valid data', async () => {
      // Arrange
      const departmentData = { name: 'Neurology', description: 'Brain care' };
      const mockDepartment = {
        id: 1,
        name: 'Neurology',
        description: 'Brain care',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.create(departmentData);

      // Assert
      expect(result).toBeValidDepartment();
      expect(result.name).toBe('Neurology');
      expect(result.description).toBe('Brain care');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO departments'), [
        'Neurology',
        'Brain care',
      ]);
    });

    it('should set is_system=false for non-system departments', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Neurology',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.create({ name: 'Neurology', description: 'Brain care' });

      // Assert
      expect(result.is_system).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_system, active'),
        expect.any(Array)
      );
    });

    it('should set active=true by default', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Neurology',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.create({ name: 'Neurology', description: 'Brain care' });

      // Assert
      expect(result.active).toBe(true);
    });

    it('should handle description=null', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Neurology',
        description: null,
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.create({ name: 'Neurology' });

      // Assert
      expect(result.description).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['Neurology', null]);
    });

    it('should prevent duplicate names via UNIQUE constraint', async () => {
      // Arrange
      const dbError = new Error('duplicate key value violates unique constraint');
      dbError.code = '23505';
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        Department.create({ name: 'Cardiology', description: 'Heart care' })
      ).rejects.toThrow('duplicate key value');
    });

    it('should handle names with whitespace', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Emergency Department',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.create({ name: 'Emergency Department', description: 'ER' });

      // Assert
      expect(result.name).toBe('Emergency Department');
    });

    it('should enforce name length limits via database', async () => {
      // Arrange
      const longName = 'A'.repeat(101);
      const dbError = new Error('value too long for type character varying(100)');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.create({ name: longName, description: 'Test' })).rejects.toThrow(
        'value too long'
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        Department.create({ name: 'Neurology', description: 'Brain care' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    it('should update non-system department name', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Updated Name',
        description: 'Old description',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.update(1, { name: 'Updated Name' });

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Name');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $2 AND is_system = false'),
        expect.any(Array)
      );
    });

    it('should update non-system department description', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        description: 'Updated description',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.update(1, { description: 'Updated description' });

      // Assert
      expect(result.description).toBe('Updated description');
    });

    it('should update non-system department active status', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.update(1, { active: false });

      // Assert
      expect(result.active).toBe(false);
    });

    it('should prevent updating system department', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.update(1, { name: 'New Name' });

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_system = false'),
        expect.any(Array)
      );
    });

    it('should return updated department', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Updated',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.update(1, { name: 'Updated' });

      // Assert
      expect(result).toBeValidDepartment();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should handle partial updates - only name', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'New Name',
        description: 'Old description',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.update(1, { name: 'New Name' });

      // Assert
      expect(result.name).toBe('New Name');
    });

    it('should handle partial updates - only description', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        description: 'New description',
        is_system: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.update(1, { description: 'New description' });

      // Assert
      expect(result.description).toBe('New description');
    });

    it('should prevent duplicate names via UNIQUE constraint', async () => {
      // Arrange
      const dbError = new Error('duplicate key value violates unique constraint');
      dbError.code = '23505';
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.update(1, { name: 'Existing Name' })).rejects.toThrow(
        'duplicate key value'
      );
    });

    it('should return undefined for non-existent ID', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.update(999, { name: 'New Name' });

      // Assert
      expect(result).toBeUndefined();
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.update(1, { name: 'New Name' })).rejects.toThrow('Database error');
    });
  });

  describe('deactivate', () => {
    it('should soft-delete non-system department', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.deactivate(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.active).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET active = false'), [1]);
    });

    it('should prevent deactivating system department', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.deactivate(1);

      // Assert
      expect(result).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('is_system = false'), [1]);
    });

    it('should return deactivated department', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      const result = await Department.deactivate(1);

      // Assert
      expect(result).toBeValidDepartment();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('should return undefined for non-existent ID', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Department.deactivate(999);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should update updated_at timestamp', async () => {
      // Arrange
      const mockDepartment = {
        id: 1,
        name: 'Cardiology',
        is_system: false,
        active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValue({ rows: [mockDepartment] });

      // Act
      await Department.deactivate(1);

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
      await expect(Department.deactivate(1)).rejects.toThrow('Database error');
    });
  });

  describe('countUsers', () => {
    it('should count users assigned to department', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '5' }] });

      // Act
      const result = await Department.countUsers('Cardiology');

      // Assert
      expect(result).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM users WHERE department = $1',
        ['Cardiology']
      );
    });

    it('should return 0 for department with no users', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '0' }] });

      // Act
      const result = await Department.countUsers('New Department');

      // Assert
      expect(result).toBe(0);
    });

    it('should count all users regardless of status', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '10' }] });

      // Act
      const result = await Department.countUsers('Cardiology');

      // Assert
      expect(result).toBe(10);
      expect(pool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('status ='),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.countUsers('Cardiology')).rejects.toThrow('Database error');
    });
  });

  describe('countTickets', () => {
    it('should count tickets in department', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '15' }] });

      // Act
      const result = await Department.countTickets('Cardiology');

      // Assert
      expect(result).toBe(15);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM tickets WHERE reporter_department = $1',
        ['Cardiology']
      );
    });

    it('should return 0 for department with no tickets', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '0' }] });

      // Act
      const result = await Department.countTickets('New Department');

      // Assert
      expect(result).toBe(0);
    });

    it('should count all tickets regardless of status', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [{ count: '25' }] });

      // Act
      const result = await Department.countTickets('Cardiology');

      // Assert
      expect(result).toBe(25);
      expect(pool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('status ='),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.countTickets('Cardiology')).rejects.toThrow('Database error');
    });
  });

  describe('getUsers', () => {
    it('should return all users assigned to department', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 1,
          username: 'user1',
          email: 'user1@example.com',
          role: 'department',
          status: 'active',
          created_at: new Date(),
        },
        {
          id: 2,
          username: 'user2',
          email: 'user2@example.com',
          role: 'department',
          status: 'active',
          created_at: new Date(),
        },
      ];
      pool.query.mockResolvedValue({ rows: mockUsers });

      // Act
      const result = await Department.getUsers('Cardiology');

      // Assert
      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE department = $1'), [
        'Cardiology',
      ]);
    });

    it('should order users by username', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Department.getUsers('Cardiology');

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY username'),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.getUsers('Cardiology')).rejects.toThrow('Database error');
    });
  });

  describe('getAvailableUsers', () => {
    it('should return users NOT assigned to department', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 3,
          username: 'user3',
          email: 'user3@example.com',
          role: 'department',
          status: 'active',
          department: 'Radiology',
        },
      ];
      pool.query.mockResolvedValue({ rows: mockUsers });

      // Act
      const result = await Department.getAvailableUsers('Cardiology');

      // Assert
      expect(result).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (department != $1 OR department IS NULL)'),
        ['Cardiology']
      );
    });

    it('should only return active department role users', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      await Department.getAvailableUsers('Cardiology');

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("role = 'department'"),
        expect.any(Array)
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        expect.any(Array)
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database error');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Department.getAvailableUsers('Cardiology')).rejects.toThrow('Database error');
    });
  });
});
