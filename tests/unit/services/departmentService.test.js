/**
 * Department Service Unit Tests
 *
 * Tests the DepartmentService in isolation with all dependencies mocked.
 * Covers extensive business logic including:
 * - CRUD operations with system department protection
 * - User assignment with safety checks
 * - Audit logging for all operations
 * - Validation and error handling
 */

const departmentService = require('../../../services/departmentService');
const Department = require('../../../models/Department');
const AuditLog = require('../../../models/AuditLog');
const User = require('../../../models/User');

// Mock dependencies
jest.mock('../../../models/Department');
jest.mock('../../../models/AuditLog');
jest.mock('../../../models/User');
jest.mock('../../../utils/logger');

describe('Department Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveDepartments', () => {
    it('should fetch active departments without system departments', async () => {
      // Arrange
      const mockDepartments = [
        { id: 1, name: 'Emergency Department', active: true, is_system: false },
        { id: 2, name: 'Cardiology', active: true, is_system: false },
      ];
      Department.findAll.mockResolvedValue(mockDepartments);

      // Act
      const result = await departmentService.getActiveDepartments(false);

      // Assert
      expect(result).toEqual(mockDepartments);
      expect(Department.findAll).toHaveBeenCalledWith(false);
    });

    it('should fetch active departments including system departments', async () => {
      // Arrange
      const mockDepartments = [
        { id: 1, name: 'Emergency Department', active: true, is_system: false },
        { id: 2, name: 'Internal', active: true, is_system: true },
      ];
      Department.findAll.mockResolvedValue(mockDepartments);

      // Act
      const result = await departmentService.getActiveDepartments(true);

      // Assert
      expect(result).toEqual(mockDepartments);
      expect(Department.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('getAllDepartments', () => {
    it('should fetch all departments for admin management', async () => {
      // Arrange
      const mockDepartments = [
        { id: 1, name: 'Active Dept', active: true, is_system: false },
        { id: 2, name: 'Inactive Dept', active: false, is_system: false },
      ];
      Department.findAllForAdmin.mockResolvedValue(mockDepartments);

      // Act
      const result = await departmentService.getAllDepartments();

      // Assert
      expect(result).toEqual(mockDepartments);
      expect(Department.findAllForAdmin).toHaveBeenCalled();
    });
  });

  describe('getDepartmentById', () => {
    it('should return department when found', async () => {
      // Arrange
      const mockDepartment = { id: 1, name: 'Emergency Department' };
      Department.findById.mockResolvedValue(mockDepartment);

      // Act
      const result = await departmentService.getDepartmentById(1);

      // Assert
      expect(result).toEqual(mockDepartment);
    });

    it('should throw error when department not found', async () => {
      // Arrange
      Department.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(departmentService.getDepartmentById(999)).rejects.toThrow(
        'Department not found'
      );
    });
  });

  describe('createDepartment', () => {
    it('should create department with valid data', async () => {
      // Arrange
      const actorId = 1;
      const deptData = {
        name: 'New Department',
        description: 'Test description',
        floor: 'Ground Floor',
      };
      const mockCreated = { id: 1, ...deptData, is_system: false, active: true };

      Department.findByName.mockResolvedValue(null); // No duplicate
      Department.create.mockResolvedValue(mockCreated);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await departmentService.createDepartment(actorId, deptData, '127.0.0.1');

      // Assert
      expect(result).toEqual(mockCreated);
      expect(Department.create).toHaveBeenCalledWith({
        name: 'New Department',
        description: 'Test description',
        floor: 'Ground Floor',
      });
    });

    it('should trim whitespace from department name', async () => {
      // Arrange
      const deptData = { name: '  Radiology  ', description: 'Test', floor: 'Ground Floor' };
      const mockCreated = { id: 1, name: 'Radiology', description: 'Test' };

      Department.findByName.mockResolvedValue(null);
      Department.create.mockResolvedValue(mockCreated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.createDepartment(1, deptData, '127.0.0.1');

      // Assert
      expect(Department.findByName).toHaveBeenCalledWith('Radiology');
      expect(Department.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Radiology' })
      );
    });

    it('should trim whitespace from description', async () => {
      // Arrange
      const deptData = { name: 'Test', description: '  Description  ', floor: 'Ground Floor' };
      const mockCreated = { id: 1, name: 'Test', description: 'Description' };

      Department.findByName.mockResolvedValue(null);
      Department.create.mockResolvedValue(mockCreated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.createDepartment(1, deptData, '127.0.0.1');

      // Assert
      expect(Department.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Description' })
      );
    });

    it('should reject empty department name', async () => {
      // Arrange
      const deptData = { name: '', description: 'Test' };

      // Act & Assert
      await expect(departmentService.createDepartment(1, deptData, '127.0.0.1')).rejects.toThrow(
        'Department name is required'
      );

      expect(Department.create).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only department name', async () => {
      // Arrange
      const deptData = { name: '   ', description: 'Test' };

      // Act & Assert
      await expect(departmentService.createDepartment(1, deptData, '127.0.0.1')).rejects.toThrow(
        'Department name is required'
      );
    });

    it('should reject duplicate department name', async () => {
      // Arrange
      const deptData = { name: 'Existing Dept', description: 'Test', floor: 'Ground Floor' };
      const existing = { id: 5, name: 'Existing Dept' };

      Department.findByName.mockResolvedValue(existing);

      // Act & Assert
      await expect(departmentService.createDepartment(1, deptData, '127.0.0.1')).rejects.toThrow(
        'Department with this name already exists'
      );

      expect(Department.create).not.toHaveBeenCalled();
    });

    it('should create audit log with correct details', async () => {
      // Arrange
      const actorId = 42;
      const deptData = { name: 'Surgery', description: 'Surgical services', floor: 'Ground Floor' };
      const mockCreated = { id: 10, ...deptData };

      Department.findByName.mockResolvedValue(null);
      Department.create.mockResolvedValue(mockCreated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.createDepartment(actorId, deptData, '192.168.1.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 42,
        action: 'CREATE_DEPARTMENT',
        targetType: 'department',
        targetId: 10,
        details: { name: 'Surgery', description: 'Surgical services', floor: 'Ground Floor' },
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('updateDepartment', () => {
    it('should update department name', async () => {
      // Arrange
      const current = { id: 1, name: 'Old Name', description: 'Desc', is_system: false };
      const updated = { id: 1, name: 'New Name', description: 'Desc', is_system: false };

      Department.findById.mockResolvedValue(current);
      Department.findByName.mockResolvedValue(null); // No duplicate
      Department.update.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await departmentService.updateDepartment(
        1,
        1,
        { name: 'New Name' },
        '127.0.0.1'
      );

      // Assert
      expect(result).toEqual(updated);
      expect(Department.update).toHaveBeenCalledWith(1, {
        name: 'New Name',
        description: undefined,
        active: undefined,
      });
    });

    it('should update description only', async () => {
      // Arrange
      const current = { id: 1, name: 'Dept', description: 'Old desc', is_system: false };
      const updated = { id: 1, name: 'Dept', description: 'New desc', is_system: false };

      Department.findById.mockResolvedValue(current);
      Department.update.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.updateDepartment(1, 1, { description: 'New desc' }, '127.0.0.1');

      // Assert
      expect(Department.update).toHaveBeenCalledWith(1, {
        name: undefined,
        description: 'New desc',
        active: undefined,
      });
    });

    it('should update active status', async () => {
      // Arrange
      const current = { id: 1, name: 'Dept', description: 'Desc', is_system: false, active: true };
      const updated = { ...current, active: false };

      Department.findById.mockResolvedValue(current);
      Department.update.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.updateDepartment(1, 1, { active: false }, '127.0.0.1');

      // Assert
      expect(Department.update).toHaveBeenCalledWith(1, {
        name: undefined,
        description: undefined,
        active: false,
      });
    });

    it('should reject updating system department', async () => {
      // Arrange
      const systemDept = { id: 1, name: 'Internal', is_system: true };
      Department.findById.mockResolvedValue(systemDept);

      // Act & Assert
      await expect(
        departmentService.updateDepartment(1, 1, { name: 'New Name' }, '127.0.0.1')
      ).rejects.toThrow('Cannot edit system department');

      expect(Department.update).not.toHaveBeenCalled();
    });

    it('should reject duplicate name (different department)', async () => {
      // Arrange
      const current = { id: 1, name: 'Dept A', is_system: false };
      const existing = { id: 2, name: 'Dept B' };

      Department.findById.mockResolvedValue(current);
      Department.findByName.mockResolvedValue(existing); // Another dept exists

      // Act & Assert
      await expect(
        departmentService.updateDepartment(1, 1, { name: 'Dept B' }, '127.0.0.1')
      ).rejects.toThrow('Department with this name already exists');

      expect(Department.update).not.toHaveBeenCalled();
    });

    it('should allow updating to same name (no duplicate)', async () => {
      // Arrange
      const current = { id: 1, name: 'Same Name', is_system: false };
      const updated = { id: 1, name: 'Same Name', description: 'Updated' };

      Department.findById.mockResolvedValue(current);
      Department.findByName.mockResolvedValue(current); // Same department
      Department.update.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.updateDepartment(
        1,
        1,
        { name: 'Same Name', description: 'Updated' },
        '127.0.0.1'
      );

      // Assert
      expect(Department.update).toHaveBeenCalled();
    });

    it('should trim whitespace from name and description', async () => {
      // Arrange
      const current = { id: 1, name: 'Old', description: 'Old', is_system: false };
      const updated = { id: 1, name: 'New', description: 'Desc' };

      Department.findById.mockResolvedValue(current);
      Department.findByName.mockResolvedValue(null);
      Department.update.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.updateDepartment(
        1,
        1,
        { name: '  New  ', description: '  Desc  ' },
        '127.0.0.1'
      );

      // Assert
      expect(Department.update).toHaveBeenCalledWith(1, {
        name: 'New',
        description: 'Desc',
        active: undefined,
      });
    });

    it('should throw error when update fails (returns undefined)', async () => {
      // Arrange
      const current = { id: 1, name: 'Dept', is_system: false };

      Department.findById.mockResolvedValue(current);
      Department.update.mockResolvedValue(undefined); // Update failed

      // Act & Assert
      await expect(
        departmentService.updateDepartment(1, 1, { name: 'New' }, '127.0.0.1')
      ).rejects.toThrow('Failed to update department');
    });

    it('should create audit log with old and new values', async () => {
      // Arrange
      const actorId = 5;
      const current = {
        id: 10,
        name: 'Old Name',
        description: 'Old Desc',
        is_system: false,
        active: true,
      };
      const updated = { id: 10, name: 'New Name', description: 'New Desc', active: false };

      Department.findById.mockResolvedValue(current);
      Department.findByName.mockResolvedValue(null);
      Department.update.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.updateDepartment(
        actorId,
        10,
        { name: 'New Name', description: 'New Desc', active: false },
        '10.0.0.1'
      );

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 5,
        action: 'UPDATE_DEPARTMENT',
        targetType: 'department',
        targetId: 10,
        details: {
          old: { name: 'Old Name', description: 'Old Desc', active: true },
          new: { name: 'New Name', description: 'New Desc', active: false },
        },
        ipAddress: '10.0.0.1',
      });
    });
  });

  describe('deactivateDepartment', () => {
    it('should deactivate department when no users assigned', async () => {
      // Arrange
      const dept = { id: 1, name: 'Empty Dept', is_system: false };
      const deactivated = { ...dept, active: false };

      Department.findById.mockResolvedValue(dept);
      Department.countUsers.mockResolvedValue(0);
      Department.deactivate.mockResolvedValue(deactivated);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await departmentService.deactivateDepartment(1, 1, '127.0.0.1');

      // Assert
      expect(result).toEqual(deactivated);
      expect(Department.deactivate).toHaveBeenCalledWith(1);
    });

    it('should reject deactivation when users are assigned', async () => {
      // Arrange
      const dept = { id: 1, name: 'Busy Dept', is_system: false };

      Department.findById.mockResolvedValue(dept);
      Department.countUsers.mockResolvedValue(5); // 5 users assigned

      // Act & Assert
      await expect(departmentService.deactivateDepartment(1, 1, '127.0.0.1')).rejects.toThrow(
        'Cannot deactivate department: 5 user(s) still assigned'
      );

      expect(Department.deactivate).not.toHaveBeenCalled();
    });

    it('should reject deactivating system department', async () => {
      // Arrange
      const systemDept = { id: 1, name: 'Internal', is_system: true };

      Department.findById.mockResolvedValue(systemDept);

      // Act & Assert
      await expect(departmentService.deactivateDepartment(1, 1, '127.0.0.1')).rejects.toThrow(
        'Cannot deactivate system department'
      );

      expect(Department.countUsers).not.toHaveBeenCalled();
      expect(Department.deactivate).not.toHaveBeenCalled();
    });

    it('should throw error when deactivation fails', async () => {
      // Arrange
      const dept = { id: 1, name: 'Dept', is_system: false };

      Department.findById.mockResolvedValue(dept);
      Department.countUsers.mockResolvedValue(0);
      Department.deactivate.mockResolvedValue(undefined); // Failed

      // Act & Assert
      await expect(departmentService.deactivateDepartment(1, 1, '127.0.0.1')).rejects.toThrow(
        'Failed to deactivate department'
      );
    });

    it('should create audit log', async () => {
      // Arrange
      const actorId = 3;
      const dept = { id: 7, name: 'Test Dept', is_system: false };
      const deactivated = { ...dept, active: false };

      Department.findById.mockResolvedValue(dept);
      Department.countUsers.mockResolvedValue(0);
      Department.deactivate.mockResolvedValue(deactivated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.deactivateDepartment(actorId, 7, '192.168.1.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 3,
        action: 'DEACTIVATE_DEPARTMENT',
        targetType: 'department',
        targetId: 7,
        details: { name: 'Test Dept' },
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('reactivateDepartment', () => {
    it('should reactivate department', async () => {
      // Arrange
      const dept = { id: 1, name: 'Inactive Dept', active: false };
      const reactivated = { ...dept, active: true };

      Department.findById.mockResolvedValue(dept);
      Department.update.mockResolvedValue(reactivated);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await departmentService.reactivateDepartment(1, 1, '127.0.0.1');

      // Assert
      expect(result).toEqual(reactivated);
      expect(Department.update).toHaveBeenCalledWith(1, { active: true });
    });

    it('should create audit log', async () => {
      // Arrange
      const actorId = 2;
      const dept = { id: 5, name: 'Reactivating Dept', active: false };
      const reactivated = { ...dept, active: true };

      Department.findById.mockResolvedValue(dept);
      Department.update.mockResolvedValue(reactivated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.reactivateDepartment(actorId, 5, '10.0.0.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'REACTIVATE_DEPARTMENT',
        targetType: 'department',
        targetId: 5,
        details: { name: 'Reactivating Dept' },
        ipAddress: '10.0.0.1',
      });
    });
  });

  describe('getDepartmentUsers', () => {
    it('should return users assigned to department', async () => {
      // Arrange
      const dept = { id: 1, name: 'Emergency Department' };
      const mockUsers = [
        { id: 1, username: 'user1' },
        { id: 2, username: 'user2' },
      ];

      Department.findById.mockResolvedValue(dept);
      Department.getUsers.mockResolvedValue(mockUsers);

      // Act
      const result = await departmentService.getDepartmentUsers(1);

      // Assert
      expect(result).toEqual(mockUsers);
      expect(Department.getUsers).toHaveBeenCalledWith('Emergency Department');
    });
  });

  describe('getAvailableUsers', () => {
    it('should return users available for assignment', async () => {
      // Arrange
      const dept = { id: 1, name: 'Cardiology' };
      const mockUsers = [
        { id: 3, username: 'available1', department: null },
        { id: 4, username: 'available2', department: 'Other Dept' },
      ];

      Department.findById.mockResolvedValue(dept);
      Department.getAvailableUsers.mockResolvedValue(mockUsers);

      // Act
      const result = await departmentService.getAvailableUsers(1);

      // Assert
      expect(result).toEqual(mockUsers);
      expect(Department.getAvailableUsers).toHaveBeenCalledWith('Cardiology');
    });
  });

  describe('assignUserToDepartment', () => {
    it('should assign department user to department', async () => {
      // Arrange
      const dept = { id: 1, name: 'Radiology', is_system: false };
      const user = { id: 5, username: 'deptuser', role: 'department', department: null };
      const updated = { ...user, department: 'Radiology' };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(user);
      User.updateDepartment.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await departmentService.assignUserToDepartment(1, 1, 5, '127.0.0.1');

      // Assert
      expect(result).toEqual(updated);
      expect(User.updateDepartment).toHaveBeenCalledWith(5, 'Radiology');
    });

    it('should reject assignment to system department', async () => {
      // Arrange
      const systemDept = { id: 1, name: 'Internal', is_system: true };

      Department.findById.mockResolvedValue(systemDept);

      // Act & Assert
      await expect(departmentService.assignUserToDepartment(1, 1, 5, '127.0.0.1')).rejects.toThrow(
        'Cannot assign users to system department'
      );

      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should reject when user not found', async () => {
      // Arrange
      const dept = { id: 1, name: 'Pharmacy', is_system: false };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        departmentService.assignUserToDepartment(1, 1, 999, '127.0.0.1')
      ).rejects.toThrow('User not found');

      expect(User.updateDepartment).not.toHaveBeenCalled();
    });

    it('should reject non-department role users', async () => {
      // Arrange
      const dept = { id: 1, name: 'Laboratory', is_system: false };
      const adminUser = { id: 5, username: 'admin', role: 'admin' };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(adminUser);

      // Act & Assert
      await expect(departmentService.assignUserToDepartment(1, 1, 5, '127.0.0.1')).rejects.toThrow(
        'Can only assign department users'
      );

      expect(User.updateDepartment).not.toHaveBeenCalled();
    });

    it('should create audit log with old department', async () => {
      // Arrange
      const actorId = 2;
      const dept = { id: 3, name: 'Surgery', is_system: false };
      const user = { id: 10, username: 'nurse.jane', role: 'department', department: 'Cardiology' };
      const updated = { ...user, department: 'Surgery' };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(user);
      User.updateDepartment.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.assignUserToDepartment(actorId, 3, 10, '10.0.0.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 2,
        action: 'ASSIGN_USER_TO_DEPARTMENT',
        targetType: 'user',
        targetId: 10,
        details: {
          userId: 10,
          username: 'nurse.jane',
          departmentId: 3,
          departmentName: 'Surgery',
          oldDepartment: 'Cardiology',
        },
        ipAddress: '10.0.0.1',
      });
    });
  });

  describe('removeUserFromDepartment', () => {
    it('should remove user when no active tickets', async () => {
      // Arrange
      const dept = { id: 1, name: 'Emergency Department' };
      const user = { id: 5, username: 'deptuser', department: 'Emergency Department' };
      const updated = { ...user, department: null };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(user);
      User.countActiveTickets.mockResolvedValue(0);
      User.updateDepartment.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      const result = await departmentService.removeUserFromDepartment(1, 1, 5, '127.0.0.1');

      // Assert
      expect(result).toEqual(updated);
      expect(User.updateDepartment).toHaveBeenCalledWith(5, null);
    });

    it('should reject removal when user has active tickets', async () => {
      // Arrange
      const dept = { id: 1, name: 'Cardiology' };
      const user = { id: 5, username: 'deptuser', department: 'Cardiology' };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(user);
      User.countActiveTickets.mockResolvedValue(3); // 3 active tickets

      // Act & Assert
      await expect(
        departmentService.removeUserFromDepartment(1, 1, 5, '127.0.0.1')
      ).rejects.toThrow(
        'Cannot remove user: 3 active ticket(s). Please close or reassign tickets first.'
      );

      expect(User.updateDepartment).not.toHaveBeenCalled();
    });

    it('should reject when user not found', async () => {
      // Arrange
      const dept = { id: 1, name: 'Radiology' };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        departmentService.removeUserFromDepartment(1, 1, 999, '127.0.0.1')
      ).rejects.toThrow('User not found');
    });

    it('should create audit log', async () => {
      // Arrange
      const actorId = 3;
      const dept = { id: 4, name: 'Pharmacy' };
      const user = { id: 8, username: 'pharmacist.tom', department: 'Pharmacy' };
      const updated = { ...user, department: null };

      Department.findById.mockResolvedValue(dept);
      User.findById.mockResolvedValue(user);
      User.countActiveTickets.mockResolvedValue(0);
      User.updateDepartment.mockResolvedValue(updated);
      AuditLog.create.mockResolvedValue({});

      // Act
      await departmentService.removeUserFromDepartment(actorId, 4, 8, '192.168.1.1');

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 3,
        action: 'REMOVE_USER_FROM_DEPARTMENT',
        targetType: 'user',
        targetId: 8,
        details: {
          userId: 8,
          username: 'pharmacist.tom',
          departmentId: 4,
          departmentName: 'Pharmacy',
        },
        ipAddress: '192.168.1.1',
      });
    });
  });
});
