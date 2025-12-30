const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthService {
  async authenticate(username, password) {
    const startTime = Date.now();
    try {
      logger.info('authService.authenticate: Authentication attempt', { username });

      const user = await User.findByUsernameWithPassword(username);

      // Always perform a password comparison even if user doesn't exist
      // This prevents timing attacks that could enumerate valid usernames
      // Using a dummy hash that will never match but takes similar time
      const passwordToCompare = user?.password_hash || '$2a$10$invalidhashtopreventtimingattack1234567890123456';
      const isValidPassword = await bcrypt.compare(password, passwordToCompare);

      // If user doesn't exist, return null (but after doing the comparison)
      if (!user) {
        const duration = Date.now() - startTime;
        logger.warn('authService.authenticate: Authentication failed - user not found or invalid credentials', { username, duration });
        return null;
      }

      // Check if account is locked due to too many failed attempts
      // Return null instead of throwing error to prevent user enumeration
      if (user.login_attempts >= 5) {
        const duration = Date.now() - startTime;
        logger.warn('authService.authenticate: Authentication failed - account locked', {
          username,
          userId: user.id,
          loginAttempts: user.login_attempts,
          duration
        });
        return null;
      }

      // Check if account is active
      // Return null instead of throwing error to prevent user enumeration
      if (user.status !== 'active') {
        const duration = Date.now() - startTime;
        logger.warn('authService.authenticate: Authentication failed - account not active', {
          username,
          userId: user.id,
          status: user.status,
          duration
        });
        return null;
      }

      if (!isValidPassword) {
        // Increment failed login attempts
        await User.incrementLoginAttempts(username);
        const duration = Date.now() - startTime;
        logger.warn('authService.authenticate: Authentication failed - invalid credentials', {
          username,
          userId: user.id,
          newLoginAttempts: user.login_attempts + 1,
          duration
        });
        return null;
      }

      // Reset login attempts and update last login on successful authentication
      await User.updateLastLogin(user.id);

      const duration = Date.now() - startTime;
      logger.info('authService.authenticate: Authentication successful', {
        username,
        userId: user.id,
        role: user.role,
        duration
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('authService.authenticate: Authentication error', {
        username,
        error: error.message,
        stack: error.stack,
        duration
      });
      throw error;
    }
  }

  createSessionData(user) {
    logger.debug('authService.createSessionData: Creating session data', { userId: user.id, username: user.username, role: user.role });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
  }
}

module.exports = new AuthService();
