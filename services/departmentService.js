const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');

/**
 * Department Service
 * Business logic for department management
 */
class DepartmentService {
  /**
   * Get all active departments for dropdowns
   * @param {boolean} includeSystem - Include system departments
   * @returns {Promise<Array>} Active departments
   */
  async getActiveDepartments(includeSystem = false) {
    return await Department.findAll(includeSystem);
  }

  /**
   * Get all departments for admin management
   * @returns {Promise<Array>} All departments
   */
  async getAllDepartments() {
    return await Department.findAllForAdmin();
  }

  /**
   * Get department by ID
   * @param {number} id - Department ID
   * @returns {Promise<Object>} Department
   */
  async getDepartmentById(id) {
    const department = await Department.findById(id);
    if (!department) {
      throw new Error('Department not found');
    }
    return department;
  }

  /**
   * Create new department
   * @param {number} actorId - User creating department
   * @param {Object} data - {name, description, floor}
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Created department
   */
  async createDepartment(actorId, { name, description, floor }, ipAddress) {
    // Validate name is not empty
    if (!name || name.trim() === '') {
      throw new Error('Department name is required');
    }

    // Validate floor is provided
    if (!floor || floor.trim() === '') {
      throw new Error('Floor is required');
    }

    // Check if department already exists
    const existing = await Department.findByName(name.trim());
    if (existing) {
      throw new Error('Department with this name already exists');
    }

    // Create department
    const department = await Department.create({
      name: name.trim(),
      description: description?.trim(),
      floor: floor.trim()
    });

    // Log action
    await AuditLog.create({
      actorId,
      action: 'CREATE_DEPARTMENT',
      targetType: 'department',
      targetId: department.id,
      details: { name: department.name, description: department.description, floor: department.floor },
      ipAddress
    });

    return department;
  }

  /**
   * Update department
   * @param {number} actorId - User updating department
   * @param {number} id - Department ID
   * @param {Object} data - {name, description, floor, active}
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Updated department
   */
  async updateDepartment(actorId, id, { name, description, floor, active }, ipAddress) {
    // Get current department
    const current = await this.getDepartmentById(id);

    // Prevent editing system departments
    if (current.is_system) {
      throw new Error('Cannot edit system department');
    }

    // If changing name, check for duplicates
    if (name && name !== current.name) {
      const existing = await Department.findByName(name.trim());
      if (existing && existing.id !== id) {
        throw new Error('Department with this name already exists');
      }
    }

    // Update department
    const updated = await Department.update(id, {
      name: name?.trim(),
      description: description?.trim(),
      floor: floor?.trim(),
      active
    });

    if (!updated) {
      throw new Error('Failed to update department');
    }

    // Log action
    await AuditLog.create({
      actorId,
      action: 'UPDATE_DEPARTMENT',
      targetType: 'department',
      targetId: id,
      details: {
        old: { name: current.name, description: current.description, floor: current.floor, active: current.active },
        new: { name: updated.name, description: updated.description, floor: updated.floor, active: updated.active }
      },
      ipAddress
    });

    return updated;
  }

  /**
   * Deactivate department (soft delete)
   * @param {number} actorId - User deactivating department
   * @param {number} id - Department ID
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Deactivated department
   */
  async deactivateDepartment(actorId, id, ipAddress) {
    // Get current department
    const department = await this.getDepartmentById(id);

    // Prevent deactivating system departments
    if (department.is_system) {
      throw new Error('Cannot deactivate system department');
    }

    // Check if department has users
    const userCount = await Department.countUsers(department.name);
    if (userCount > 0) {
      throw new Error(`Cannot deactivate department: ${userCount} user(s) still assigned`);
    }

    // Deactivate
    const deactivated = await Department.deactivate(id);

    if (!deactivated) {
      throw new Error('Failed to deactivate department');
    }

    // Log action
    await AuditLog.create({
      actorId,
      action: 'DEACTIVATE_DEPARTMENT',
      targetType: 'department',
      targetId: id,
      details: { name: department.name },
      ipAddress
    });

    return deactivated;
  }

  /**
   * Reactivate department
   * @param {number} actorId - User reactivating department
   * @param {number} id - Department ID
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Reactivated department
   */
  async reactivateDepartment(actorId, id, ipAddress) {
    const department = await this.getDepartmentById(id);

    const reactivated = await Department.update(id, { active: true });

    // Log action
    await AuditLog.create({
      actorId,
      action: 'REACTIVATE_DEPARTMENT',
      targetType: 'department',
      targetId: id,
      details: { name: department.name },
      ipAddress
    });

    return reactivated;
  }

  /**
   * Get users assigned to department
   * @param {number} departmentId - Department ID
   * @returns {Promise<Array>} Users in department
   */
  async getDepartmentUsers(departmentId) {
    const department = await this.getDepartmentById(departmentId);
    return await Department.getUsers(department.name);
  }

  /**
   * Get users available for assignment to department
   * @param {number} departmentId - Department ID
   * @returns {Promise<Array>} Available users
   */
  async getAvailableUsers(departmentId) {
    const department = await this.getDepartmentById(departmentId);
    return await Department.getAvailableUsers(department.name);
  }

  /**
   * Assign user to department
   * @param {number} actorId - User performing action
   * @param {number} departmentId - Department ID
   * @param {number} userId - User ID to assign
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Updated user
   */
  async assignUserToDepartment(actorId, departmentId, userId, ipAddress) {
    const department = await this.getDepartmentById(departmentId);

    // Prevent assigning users to system department
    if (department.is_system) {
      throw new Error('Cannot assign users to system department');
    }

    // Get user
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.role !== 'department') {
      throw new Error('Can only assign department users');
    }

    // Update user's department
    const updated = await User.updateDepartment(userId, department.name);

    // Log action
    await AuditLog.create({
      actorId,
      action: 'ASSIGN_USER_TO_DEPARTMENT',
      targetType: 'user',
      targetId: userId,
      details: {
        userId,
        username: user.username,
        departmentId,
        departmentName: department.name,
        oldDepartment: user.department
      },
      ipAddress
    });

    return updated;
  }

  /**
   * Remove user from department
   * @param {number} actorId - User performing action
   * @param {number} departmentId - Department ID
   * @param {number} userId - User ID to remove
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Updated user
   */
  async removeUserFromDepartment(actorId, departmentId, userId, ipAddress) {
    const department = await this.getDepartmentById(departmentId);

    // Get user
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Safety check: prevent removing user with active tickets
    const activeTickets = await User.countActiveTickets(userId);
    if (activeTickets > 0) {
      throw new Error(`Cannot remove user: ${activeTickets} active ticket(s). Please close or reassign tickets first.`);
    }

    // Update user's department to null
    const updated = await User.updateDepartment(userId, null);

    // Log action
    await AuditLog.create({
      actorId,
      action: 'REMOVE_USER_FROM_DEPARTMENT',
      targetType: 'user',
      targetId: userId,
      details: {
        userId,
        username: user.username,
        departmentId,
        departmentName: department.name
      },
      ipAddress
    });

    return updated;
  }
}

module.exports = new DepartmentService();
