const Floor = require('../models/Floor');
const AuditLog = require('../models/AuditLog');

/**
 * Floor Service
 * Business logic for floor management
 */
class FloorService {
  /**
   * Get all active floors for dropdowns
   * @returns {Promise<Array>} Active floors
   */
  async getActiveFloors() {
    return Floor.findAll(false);
  }

  /**
   * Get all floors for admin management
   * @returns {Promise<Array>} All floors
   */
  async getAllFloors() {
    return Floor.findAllForAdmin();
  }

  /**
   * Get floor by ID
   * @param {number} id - Floor ID
   * @returns {Promise<Object>} Floor
   */
  async getFloorById(id) {
    const floor = await Floor.findById(id);
    if (!floor) {
      throw new Error('Floor not found');
    }
    return floor;
  }

  /**
   * Create new floor
   * @param {number} actorId - User creating floor
   * @param {Object} data - {name, sort_order}
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Created floor
   */
  async createFloor(actorId, { name, sort_order }, ipAddress, auditContext = {}) {
    // Validate name is not empty
    if (!name || name.trim() === '') {
      throw new Error('Floor name is required');
    }

    // Check if floor already exists (case-insensitive)
    const existing = await Floor.findByName(name.trim());
    if (existing) {
      throw new Error('Floor name already exists');
    }

    // Create floor
    const floor = await Floor.create({
      name: name.trim(),
      sort_order: sort_order || 0,
    });

    // Log action
    await AuditLog.create({
      actorId,
      action: 'FLOOR_CREATED',
      targetType: 'floor',
      targetId: floor.id,
      details: { name: floor.name, sort_order: floor.sort_order },
      ipAddress,
      actorUsername: auditContext.actorUsername,
      actorRole: auditContext.actorRole,
      sessionHash: auditContext.sessionHash,
    });

    return floor;
  }

  /**
   * Update floor
   * @param {number} actorId - User updating floor
   * @param {number} id - Floor ID
   * @param {Object} data - {name, sort_order, active}
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Updated floor
   */
  async updateFloor(actorId, id, { name, sort_order, active }, ipAddress, auditContext = {}) {
    // Get current floor
    const current = await this.getFloorById(id);

    // Prevent editing system floors
    if (current.is_system) {
      throw new Error('Cannot edit system floor');
    }

    // If changing name, check for duplicates (case-insensitive)
    if (name && name !== current.name) {
      const existing = await Floor.findByName(name.trim());
      if (existing && existing.id !== id) {
        throw new Error('Floor name already exists');
      }
    }

    // Update floor
    const updated = await Floor.update(id, {
      name: name?.trim(),
      sort_order,
      active,
    });

    if (!updated) {
      throw new Error('Failed to update floor');
    }

    // Log action
    await AuditLog.create({
      actorId,
      action: 'FLOOR_UPDATED',
      targetType: 'floor',
      targetId: id,
      details: {
        old: { name: current.name, sort_order: current.sort_order, active: current.active },
        new: { name: updated.name, sort_order: updated.sort_order, active: updated.active },
      },
      ipAddress,
      actorUsername: auditContext.actorUsername,
      actorRole: auditContext.actorRole,
      sessionHash: auditContext.sessionHash,
    });

    return updated;
  }

  /**
   * Deactivate floor (soft delete)
   * @param {number} actorId - User deactivating floor
   * @param {number} id - Floor ID
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Deactivated floor
   */
  async deactivateFloor(actorId, id, ipAddress, auditContext = {}) {
    // Get current floor
    const floor = await this.getFloorById(id);

    // Prevent deactivating system floors
    if (floor.is_system) {
      throw new Error('Cannot deactivate system floor');
    }

    // Check if floor has departments
    const departmentCount = await Floor.countDepartments(floor.name);
    if (departmentCount > 0) {
      throw new Error(
        `Cannot deactivate floor: ${departmentCount} department(s) still assigned. Please reassign departments first.`
      );
    }

    // Deactivate
    const deactivated = await Floor.deactivate(id);

    if (!deactivated) {
      throw new Error('Failed to deactivate floor');
    }

    // Log action
    await AuditLog.create({
      actorId,
      action: 'FLOOR_DEACTIVATED',
      targetType: 'floor',
      targetId: id,
      details: { name: floor.name },
      ipAddress,
      actorUsername: auditContext.actorUsername,
      actorRole: auditContext.actorRole,
      sessionHash: auditContext.sessionHash,
    });

    return deactivated;
  }

  /**
   * Reactivate floor
   * @param {number} actorId - User reactivating floor
   * @param {number} id - Floor ID
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Reactivated floor
   */
  async reactivateFloor(actorId, id, ipAddress, auditContext = {}) {
    // Get current floor
    const floor = await this.getFloorById(id);

    // Reactivate
    const reactivated = await Floor.reactivate(id);

    // Log action
    await AuditLog.create({
      actorId,
      action: 'FLOOR_REACTIVATED',
      targetType: 'floor',
      targetId: id,
      details: { name: floor.name },
      ipAddress,
      actorUsername: auditContext.actorUsername,
      actorRole: auditContext.actorRole,
      sessionHash: auditContext.sessionHash,
    });

    return reactivated;
  }
}

module.exports = new FloorService();
