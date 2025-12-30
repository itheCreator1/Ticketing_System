const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/passwordValidator');
const logger = require('../utils/logger');

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
    const startTime = Date.now();
    try {
      logger.info('userService.createUser: Creating new user', { username: userData.username, email: userData.email, role: userData.role });
      const user = await User.create(userData);
      const duration = Date.now() - startTime;
      logger.info('userService.createUser: User created successfully', { userId: user.id, username: user.username, email: user.email, role: user.role, duration });
      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('userService.createUser: Failed to create user', {
        username: userData.username,
        email: userData.email,
        role: userData.role,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  // FIX: Update the broken changePassword method
  async changePassword(userId, currentPassword, newPassword) {
    const startTime = Date.now();
    try {
      logger.info('userService.changePassword: Password change initiated', { userId });
      const user = await User.findByUsername((await User.findById(userId)).username);
      if (!user) {
        logger.warn('userService.changePassword: User not found', { userId });
        throw new Error('User not found');
      }

      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        logger.warn('userService.changePassword: Current password incorrect', { userId, username: user.username });
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      const validation = validatePassword(newPassword);
      if (!validation.isValid) {
        logger.warn('userService.changePassword: New password validation failed', { userId, errors: validation.errors });
        throw new Error(validation.errors.join(', '));
      }

      await User.updatePassword(userId, newPassword);
      const duration = Date.now() - startTime;
      logger.info('userService.changePassword: Password changed successfully', { userId, username: user.username, duration });
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('userService.changePassword: Failed to change password', {
        userId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  // NEW: Update user (with business logic validation)
  async updateUser(actorId, targetId, updates, ipAddress) {
    const startTime = Date.now();
    const { username, email, role, status } = updates;
    const changedFields = Object.keys(updates).filter(key => updates[key] !== undefined);

    try {
      logger.info('userService.updateUser: User update initiated', { actorId, targetId, changedFields, ipAddress });

      const targetUser = await User.findById(targetId);

      if (!targetUser) {
        logger.warn('userService.updateUser: Target user not found', { actorId, targetId });
        throw new Error('User not found');
      }

      // Prevent downgrading last super_admin
      if (role && targetUser.role === 'super_admin' && role !== 'super_admin') {
        const superAdminCount = await User.countActiveSuperAdmins();
        if (superAdminCount <= 1) {
          logger.warn('userService.updateUser: Cannot downgrade last super admin', { actorId, targetId, currentRole: targetUser.role, newRole: role });
          throw new Error('Cannot downgrade the last super admin');
        }
      }

      // Prevent deactivating/deleting last super_admin
      if (status && status !== 'active' && targetUser.role === 'super_admin') {
        const superAdminCount = await User.countActiveSuperAdmins();
        if (superAdminCount <= 1) {
          logger.warn('userService.updateUser: Cannot deactivate last super admin', { actorId, targetId, currentStatus: targetUser.status, newStatus: status });
          throw new Error('Cannot deactivate the last super admin');
        }
      }

      const updatedUser = await User.update(targetId, updates);

      // Clear user sessions if status changed to inactive or deleted
      if (status && status !== 'active' && status !== targetUser.status) {
        const sessionsCleared = await User.clearUserSessions(targetId);
        logger.info('userService.updateUser: User sessions cleared', { targetId, reason: 'status_change', newStatus: status, sessionsCleared });
      }

      // Audit log
      await AuditLog.create({
        actorId,
        action: 'USER_UPDATED',
        targetType: 'user',
        targetId,
        details: { changes: updates },
        ipAddress
      });

      const duration = Date.now() - startTime;
      logger.info('userService.updateUser: User updated successfully', { actorId, targetId, targetUsername: targetUser.username, changedFields, duration });

      return updatedUser;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('userService.updateUser: Failed to update user', {
        actorId,
        targetId,
        changedFields,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  // NEW: Delete user (soft delete)
  async deleteUser(actorId, targetId, ipAddress) {
    const startTime = Date.now();
    try {
      logger.info('userService.deleteUser: User deletion initiated', { actorId, targetId, ipAddress });

      const target = await User.findById(targetId);

      if (!target) {
        logger.warn('userService.deleteUser: Target user not found', { actorId, targetId });
        throw new Error('User not found');
      }

      // Prevent self-deletion
      if (actorId === targetId) {
        logger.warn('userService.deleteUser: Attempted self-deletion', { actorId, targetId });
        throw new Error('Cannot delete yourself');
      }

      // Prevent deleting last super_admin
      if (target.role === 'super_admin') {
        const superAdminCount = await User.countActiveSuperAdmins();
        if (superAdminCount <= 1) {
          logger.warn('userService.deleteUser: Cannot delete last super admin', { actorId, targetId, targetUsername: target.username });
          throw new Error('Cannot delete the last super admin');
        }
      }

      await User.softDelete(targetId);

      // Clear all sessions for the deleted user
      const sessionsCleared = await User.clearUserSessions(targetId);
      logger.info('userService.deleteUser: User sessions cleared', { targetId, reason: 'user_deletion', sessionsCleared });

      // Audit log
      await AuditLog.create({
        actorId,
        action: 'USER_DELETED',
        targetType: 'user',
        targetId,
        details: { deletedUser: { username: target.username, email: target.email, role: target.role } },
        ipAddress
      });

      const duration = Date.now() - startTime;
      logger.info('userService.deleteUser: User deleted successfully', { actorId, targetId, targetUsername: target.username, duration });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('userService.deleteUser: Failed to delete user', {
        actorId,
        targetId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  // NEW: Reset user password (admin function, no current password required)
  async resetUserPassword(actorId, targetId, newPassword, ipAddress) {
    const startTime = Date.now();
    try {
      logger.info('userService.resetUserPassword: Password reset initiated', { actorId, targetId, ipAddress });

      const target = await User.findById(targetId);
      if (!target) {
        logger.warn('userService.resetUserPassword: Target user not found', { actorId, targetId });
        throw new Error('User not found');
      }

      // Validate new password
      const validation = validatePassword(newPassword);
      if (!validation.isValid) {
        logger.warn('userService.resetUserPassword: Password validation failed', { actorId, targetId, errors: validation.errors });
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

      const duration = Date.now() - startTime;
      logger.info('userService.resetUserPassword: Password reset successfully', { actorId, targetId, targetUsername: target.username, duration });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('userService.resetUserPassword: Failed to reset password', {
        actorId,
        targetId,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  // NEW: Toggle user status
  async toggleUserStatus(actorId, targetId, newStatus, ipAddress) {
    return await this.updateUser(actorId, targetId, { status: newStatus }, ipAddress);
  }
}

module.exports = new UserService();
