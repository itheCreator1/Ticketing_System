const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/passwordValidator');

class UserService {
  async getUserById(id) {
    return await User.findById(id);
  }

  async getUserByUsername(username) {
    return await User.findByUsername(username);
  }

  async getAllUsers() {
    return await User.findAllActive();
  }

  async createUser(userData) {
    return await User.create(userData);
  }

  // FIX: Update the broken changePassword method
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByUsername((await User.findById(userId)).username);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    await User.updatePassword(userId, newPassword);
    return true;
  }

  // NEW: Update user (with business logic validation)
  async updateUser(actorId, targetId, updates, ipAddress) {
    const { username, email, role, status } = updates;
    const targetUser = await User.findById(targetId);

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Prevent downgrading last super_admin
    if (role && targetUser.role === 'super_admin' && role !== 'super_admin') {
      const superAdminCount = await User.countActiveSuperAdmins();
      if (superAdminCount <= 1) {
        throw new Error('Cannot downgrade the last super admin');
      }
    }

    // Prevent deactivating/deleting last super_admin
    if (status && status !== 'active' && targetUser.role === 'super_admin') {
      const superAdminCount = await User.countActiveSuperAdmins();
      if (superAdminCount <= 1) {
        throw new Error('Cannot deactivate the last super admin');
      }
    }

    const updatedUser = await User.update(targetId, updates);

    // Audit log
    await AuditLog.create({
      actorId,
      action: 'USER_UPDATED',
      targetType: 'user',
      targetId,
      details: { changes: updates },
      ipAddress
    });

    return updatedUser;
  }

  // NEW: Delete user (soft delete)
  async deleteUser(actorId, targetId, ipAddress) {
    const target = await User.findById(targetId);

    if (!target) {
      throw new Error('User not found');
    }

    // Prevent self-deletion
    if (actorId === targetId) {
      throw new Error('Cannot delete yourself');
    }

    // Prevent deleting last super_admin
    if (target.role === 'super_admin') {
      const superAdminCount = await User.countActiveSuperAdmins();
      if (superAdminCount <= 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    await User.softDelete(targetId);

    // Audit log
    await AuditLog.create({
      actorId,
      action: 'USER_DELETED',
      targetType: 'user',
      targetId,
      details: { deletedUser: { username: target.username, email: target.email, role: target.role } },
      ipAddress
    });

    return true;
  }

  // NEW: Reset user password (admin function, no current password required)
  async resetUserPassword(actorId, targetId, newPassword, ipAddress) {
    const target = await User.findById(targetId);
    if (!target) {
      throw new Error('User not found');
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    await User.updatePassword(targetId, newPassword);

    // Audit log
    await AuditLog.create({
      actorId,
      action: 'PASSWORD_RESET',
      targetType: 'user',
      targetId,
      details: { resetBy: 'admin' },
      ipAddress
    });

    return true;
  }

  // NEW: Toggle user status
  async toggleUserStatus(actorId, targetId, newStatus, ipAddress) {
    return await this.updateUser(actorId, targetId, { status: newStatus }, ipAddress);
  }
}

module.exports = new UserService();
