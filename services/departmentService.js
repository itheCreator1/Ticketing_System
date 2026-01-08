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
   * @param {Object} data - {name, description}
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Created department
   */
  async createDepartment(actorId, { name, description }, ipAddress) {
    // Validate name is not empty
    if (!name || name.trim() === '') {
      throw new Error('Department name is required');
    }

    // Check if department already exists
    const existing = await Department.findByName(name.trim());
    if (existing) {
      throw new Error('Department with this name already exists');
    }

    // Create department
    const department = await Department.create({
      name: name.trim(),
      description: description?.trim()
    });

    // Log action
    await AuditLog.create({
      actorId,
      action: 'CREATE_DEPARTMENT',
      targetType: 'department',
      targetId: department.id,
      details: { name: department.name, description: department.description },
      ipAddress
    });

    return department;
  }

  /**
   * Update department
   * @param {number} actorId - User updating department
   * @param {number} id - Department ID
   * @param {Object} data - {name, description, active}
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Updated department
   */
  async updateDepartment(actorId, id, { name, description, active }, ipAddress) {
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
        old: { name: current.name, description: current.description, active: current.active },
        new: { name: updated.name, description: updated.description, active: updated.active }
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
}

module.exports = new DepartmentService();
