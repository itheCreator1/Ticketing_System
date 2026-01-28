/**
 * FloorService Unit Tests
 *
 * Tests the FloorService in complete isolation with all dependencies mocked.
 * Covers all 6 methods with success, failure, edge cases, and business rule validation.
 *
 * Methods tested:
 * - getActiveFloors()
 * - getAllFloors()
 * - getFloorById(id)
 * - createFloor(actorId, data, ipAddress)
 * - updateFloor(actorId, id, data, ipAddress)
 * - deactivateFloor(actorId, id, ipAddress)
 * - reactivateFloor(actorId, id, ipAddress)
 */

const floorService = require('../../../services/floorService');
const Floor = require('../../../models/Floor');
const AuditLog = require('../../../models/AuditLog');

// Mock dependencies
jest.mock('../../../models/Floor');
jest.mock('../../../models/AuditLog');
jest.mock('../../../utils/logger');

describe('FloorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveFloors', () => {
    it('should return active floors from Floor model', async () => {
      // Arrange
      const mockFloors = [
        { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true },
        { id: 2, name: '1st Floor', sort_order: 1, is_system: false, active: true }
      ];
      Floor.findAll.mockResolvedValue(mockFloors);

      // Act
      const result = await floorService.getActiveFloors();

      // Assert
      expect(result).toEqual(mockFloors);
      expect(Floor.findAll).toHaveBeenCalledWith(false);
    });

    it('should return empty array when no active floors', async () => {
      // Arrange
      Floor.findAll.mockResolvedValue([]);

      // Act
      const result = await floorService.getActiveFloors();

      // Assert
      expect(result).toEqual([]);
    });

    it('should call findAll with includeSystem=false', async () => {
      // Arrange
      Floor.findAll.mockResolvedValue([]);

      // Act
      await floorService.getActiveFloors();

      // Assert
      expect(Floor.findAll).toHaveBeenCalledWith(false);
    });

    it('should propagate database errors', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      Floor.findAll.mockRejectedValue(dbError);

      // Act & Assert
      await expect(floorService.getActiveFloors()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAllFloors', () => {
    it('should return all floors including inactive', async () => {
      // Arrange
      const mockFloors = [
        { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true },
        { id: 2, name: 'Old Floor', sort_order: 10, is_system: false, active: false }
      ];
      Floor.findAllForAdmin.mockResolvedValue(mockFloors);

      // Act
      const result = await floorService.getAllFloors();

      // Assert
      expect(result).toEqual(mockFloors);
      expect(Floor.findAllForAdmin).toHaveBeenCalled();
    });

    it('should include system floors', async () => {
      // Arrange
      const mockFloors = [
        { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true },
        { id: 2, name: 'System Floor', sort_order: 999, is_system: true, active: true }
      ];
      Floor.findAllForAdmin.mockResolvedValue(mockFloors);

      // Act
      const result = await floorService.getAllFloors();

      // Assert
      expect(result.some(f => f.is_system)).toBe(true);
    });

    it('should return empty array when no floors', async () => {
      // Arrange
      Floor.findAllForAdmin.mockResolvedValue([]);

      // Act
      const result = await floorService.getAllFloors();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getFloorById', () => {
    it('should return floor when found', async () => {
      // Arrange
      const mockFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      Floor.findById.mockResolvedValue(mockFloor);

      // Act
      const result = await floorService.getFloorById(1);

      // Assert
      expect(result).toEqual(mockFloor);
      expect(Floor.findById).toHaveBeenCalledWith(1);
    });

    it('should throw error when floor not found', async () => {
      // Arrange
      Floor.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(floorService.getFloorById(999)).rejects.toThrow('Floor not found');
    });

    it('should propagate database errors', async () => {
      // Arrange
      const dbError = new Error('Database error');
      Floor.findById.mockRejectedValue(dbError);

      // Act & Assert
      await expect(floorService.getFloorById(1)).rejects.toThrow('Database error');
    });
  });

  describe('createFloor', () => {
    it('should create floor successfully with valid data', async () => {
      // Arrange
      const actorId = 1;
      const data = { name: '2nd Floor', sort_order: 2 };
      const ipAddress = '192.168.1.100';
      const mockFloor = { id: 2, name: '2nd Floor', sort_order: 2, is_system: false, active: true };

      Floor.findByName.mockResolvedValue(undefined);
      Floor.create.mockResolvedValue(mockFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.createFloor(actorId, data, ipAddress);

      // Assert
      expect(result).toEqual(mockFloor);
      expect(Floor.findByName).toHaveBeenCalledWith('2nd Floor');
      expect(Floor.create).toHaveBeenCalledWith({ name: '2nd Floor', sort_order: 2 });
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 1,
        action: 'FLOOR_CREATED',
        targetType: 'floor',
        targetId: 2,
        details: { name: '2nd Floor', sort_order: 2 },
        ipAddress
      });
    });

    it('should trim whitespace from floor name', async () => {
      // Arrange
      const data = { name: '  Test Floor  ', sort_order: 1 };
      const mockFloor = { id: 1, name: 'Test Floor', sort_order: 1, is_system: false, active: true };

      Floor.findByName.mockResolvedValue(undefined);
      Floor.create.mockResolvedValue(mockFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      await floorService.createFloor(1, data, '127.0.0.1');

      // Assert
      expect(Floor.findByName).toHaveBeenCalledWith('Test Floor');
      expect(Floor.create).toHaveBeenCalledWith({ name: 'Test Floor', sort_order: 1 });
    });

    it('should throw error when floor name is empty', async () => {
      // Arrange
      const data = { name: '', sort_order: 1 };

      // Act & Assert
      await expect(floorService.createFloor(1, data, '127.0.0.1')).rejects.toThrow('Floor name is required');
      expect(Floor.create).not.toHaveBeenCalled();
    });

    it('should throw error when floor name is whitespace only', async () => {
      // Arrange
      const data = { name: '   ', sort_order: 1 };

      // Act & Assert
      await expect(floorService.createFloor(1, data, '127.0.0.1')).rejects.toThrow('Floor name is required');
      expect(Floor.create).not.toHaveBeenCalled();
    });

    it('should throw error when floor name already exists', async () => {
      // Arrange
      const data = { name: 'Ground Floor', sort_order: 0 };
      const existingFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };

      Floor.findByName.mockResolvedValue(existingFloor);

      // Act & Assert
      await expect(floorService.createFloor(1, data, '127.0.0.1')).rejects.toThrow('Floor name already exists');
      expect(Floor.create).not.toHaveBeenCalled();
    });

    it('should create audit log for floor creation', async () => {
      // Arrange
      const actorId = 2;
      const data = { name: '3rd Floor', sort_order: 3 };
      const ipAddress = '10.0.0.5';
      const mockFloor = { id: 3, name: '3rd Floor', sort_order: 3, is_system: false, active: true };

      Floor.findByName.mockResolvedValue(undefined);
      Floor.create.mockResolvedValue(mockFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      await floorService.createFloor(actorId, data, ipAddress);

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'FLOOR_CREATED',
        targetType: 'floor',
        targetId: 3,
        details: { name: '3rd Floor', sort_order: 3 },
        ipAddress: '10.0.0.5'
      });
    });

    it('should use default sort_order when not provided', async () => {
      // Arrange
      const data = { name: 'Test Floor' };
      const mockFloor = { id: 1, name: 'Test Floor', sort_order: 0, is_system: false, active: true };

      Floor.findByName.mockResolvedValue(undefined);
      Floor.create.mockResolvedValue(mockFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      await floorService.createFloor(1, data, '127.0.0.1');

      // Assert
      expect(Floor.create).toHaveBeenCalledWith({ name: 'Test Floor', sort_order: 0 });
    });
  });

  describe('updateFloor', () => {
    it('should update floor successfully', async () => {
      // Arrange
      const actorId = 1;
      const floorId = 1;
      const data = { name: 'Updated Floor', sort_order: 5 };
      const ipAddress = '192.168.1.100';
      const currentFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const updatedFloor = { id: 1, name: 'Updated Floor', sort_order: 5, is_system: false, active: true };

      Floor.findById.mockResolvedValue(currentFloor);
      Floor.findByName.mockResolvedValue(undefined);
      Floor.update.mockResolvedValue(updatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.updateFloor(actorId, floorId, data, ipAddress);

      // Assert
      expect(result).toEqual(updatedFloor);
      expect(Floor.update).toHaveBeenCalledWith(floorId, data);
    });

    it('should prevent updating system floor', async () => {
      // Arrange
      const systemFloor = { id: 999, name: 'System Floor', sort_order: 999, is_system: true, active: true };
      Floor.findById.mockResolvedValue(systemFloor);

      // Act & Assert
      await expect(
        floorService.updateFloor(1, 999, { name: 'New Name' }, '127.0.0.1')
      ).rejects.toThrow('Cannot edit system floor');
      expect(Floor.update).not.toHaveBeenCalled();
    });

    it('should throw error when floor not found', async () => {
      // Arrange
      Floor.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        floorService.updateFloor(1, 999, { name: 'New Name' }, '127.0.0.1')
      ).rejects.toThrow('Floor not found');
    });

    it('should check for duplicate names when changing name', async () => {
      // Arrange
      const currentFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const existingFloor = { id: 2, name: 'New Name', sort_order: 1, is_system: false, active: true };

      Floor.findById.mockResolvedValue(currentFloor);
      Floor.findByName.mockResolvedValue(existingFloor);

      // Act & Assert
      await expect(
        floorService.updateFloor(1, 1, { name: 'New Name' }, '127.0.0.1')
      ).rejects.toThrow('Floor name already exists');
      expect(Floor.update).not.toHaveBeenCalled();
    });

    it('should allow updating name to same value', async () => {
      // Arrange
      const currentFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const updatedFloor = { id: 1, name: 'Ground Floor', sort_order: 5, is_system: false, active: true };

      Floor.findById.mockResolvedValue(currentFloor);
      Floor.update.mockResolvedValue(updatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.updateFloor(1, 1, { name: 'Ground Floor', sort_order: 5 }, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(Floor.update).toHaveBeenCalled();
    });

    it('should create audit log for floor update', async () => {
      // Arrange
      const actorId = 2;
      const floorId = 1;
      const data = { sort_order: 5 };
      const ipAddress = '10.0.0.5';
      const currentFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const updatedFloor = { id: 1, name: 'Ground Floor', sort_order: 5, is_system: false, active: true };

      Floor.findById.mockResolvedValue(currentFloor);
      Floor.findByName.mockResolvedValue(undefined);
      Floor.update.mockResolvedValue(updatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      await floorService.updateFloor(actorId, floorId, data, ipAddress);

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'FLOOR_UPDATED',
        targetType: 'floor',
        targetId: 1,
        details: expect.objectContaining({
          old: expect.any(Object),
          new: expect.any(Object)
        }),
        ipAddress: '10.0.0.5'
      });
    });

    it('should throw error when update fails', async () => {
      // Arrange
      const currentFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };

      Floor.findById.mockResolvedValue(currentFloor);
      Floor.findByName.mockResolvedValue(undefined);
      Floor.update.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        floorService.updateFloor(1, 1, { name: 'New Name' }, '127.0.0.1')
      ).rejects.toThrow('Failed to update floor');
    });
  });

  describe('deactivateFloor', () => {
    it('should deactivate floor successfully', async () => {
      // Arrange
      const actorId = 1;
      const floorId = 1;
      const ipAddress = '192.168.1.100';
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const deactivatedFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: false };

      Floor.findById.mockResolvedValue(floor);
      Floor.countDepartments.mockResolvedValue(0);
      Floor.deactivate.mockResolvedValue(deactivatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.deactivateFloor(actorId, floorId, ipAddress);

      // Assert
      expect(result).toEqual(deactivatedFloor);
      expect(Floor.deactivate).toHaveBeenCalledWith(floorId);
    });

    it('should prevent deactivating system floor', async () => {
      // Arrange
      const systemFloor = { id: 999, name: 'System Floor', sort_order: 999, is_system: true, active: true };
      Floor.findById.mockResolvedValue(systemFloor);

      // Act & Assert
      await expect(
        floorService.deactivateFloor(1, 999, '127.0.0.1')
      ).rejects.toThrow('Cannot deactivate system floor');
      expect(Floor.deactivate).not.toHaveBeenCalled();
    });

    it('should throw error when floor not found', async () => {
      // Arrange
      Floor.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        floorService.deactivateFloor(1, 999, '127.0.0.1')
      ).rejects.toThrow('Floor not found');
    });

    it('should prevent deactivating floor with assigned departments', async () => {
      // Arrange
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      Floor.findById.mockResolvedValue(floor);
      Floor.countDepartments.mockResolvedValue(3);

      // Act & Assert
      await expect(
        floorService.deactivateFloor(1, 1, '127.0.0.1')
      ).rejects.toThrow('Cannot deactivate floor: 3 department(s) still assigned');
      expect(Floor.deactivate).not.toHaveBeenCalled();
    });

    it('should allow deactivating floor with no assigned departments', async () => {
      // Arrange
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const deactivatedFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: false };

      Floor.findById.mockResolvedValue(floor);
      Floor.countDepartments.mockResolvedValue(0);
      Floor.deactivate.mockResolvedValue(deactivatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.deactivateFloor(1, 1, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(Floor.deactivate).toHaveBeenCalled();
    });

    it('should create audit log for deactivation', async () => {
      // Arrange
      const actorId = 2;
      const floorId = 1;
      const ipAddress = '10.0.0.5';
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };
      const deactivatedFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: false };

      Floor.findById.mockResolvedValue(floor);
      Floor.countDepartments.mockResolvedValue(0);
      Floor.deactivate.mockResolvedValue(deactivatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      await floorService.deactivateFloor(actorId, floorId, ipAddress);

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'FLOOR_DEACTIVATED',
        targetType: 'floor',
        targetId: 1,
        details: { name: 'Ground Floor' },
        ipAddress: '10.0.0.5'
      });
    });

    it('should throw error when deactivation fails', async () => {
      // Arrange
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };

      Floor.findById.mockResolvedValue(floor);
      Floor.countDepartments.mockResolvedValue(0);
      Floor.deactivate.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        floorService.deactivateFloor(1, 1, '127.0.0.1')
      ).rejects.toThrow('Failed to deactivate floor');
    });
  });

  describe('reactivateFloor', () => {
    it('should reactivate floor successfully', async () => {
      // Arrange
      const actorId = 1;
      const floorId = 1;
      const ipAddress = '192.168.1.100';
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: false };
      const reactivatedFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };

      Floor.findById.mockResolvedValue(floor);
      Floor.reactivate.mockResolvedValue(reactivatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.reactivateFloor(actorId, floorId, ipAddress);

      // Assert
      expect(result).toEqual(reactivatedFloor);
      expect(Floor.reactivate).toHaveBeenCalledWith(floorId);
    });

    it('should throw error when floor not found', async () => {
      // Arrange
      Floor.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        floorService.reactivateFloor(1, 999, '127.0.0.1')
      ).rejects.toThrow('Floor not found');
    });

    it('should create audit log for reactivation', async () => {
      // Arrange
      const actorId = 2;
      const floorId = 1;
      const ipAddress = '10.0.0.5';
      const floor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: false };
      const reactivatedFloor = { id: 1, name: 'Ground Floor', sort_order: 0, is_system: false, active: true };

      Floor.findById.mockResolvedValue(floor);
      Floor.reactivate.mockResolvedValue(reactivatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      await floorService.reactivateFloor(actorId, floorId, ipAddress);

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'FLOOR_REACTIVATED',
        targetType: 'floor',
        targetId: 1,
        details: { name: 'Ground Floor' },
        ipAddress: '10.0.0.5'
      });
    });

    it('should allow reactivating system floor', async () => {
      // Arrange
      const systemFloor = { id: 999, name: 'System Floor', sort_order: 999, is_system: true, active: false };
      const reactivatedFloor = { id: 999, name: 'System Floor', sort_order: 999, is_system: true, active: true };

      Floor.findById.mockResolvedValue(systemFloor);
      Floor.reactivate.mockResolvedValue(reactivatedFloor);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await floorService.reactivateFloor(1, 999, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(Floor.reactivate).toHaveBeenCalled();
    });
  });
});
