const bcrypt = require('bcryptjs');
const User = require('../models/User');

class AuthService {
  async authenticate(username, password) {
    const user = await User.findByUsername(username);
    if (!user) {
      return null;
    }

    // Check if account is locked due to too many failed attempts
    if (user.login_attempts >= 5) {
      throw new Error('Account locked due to too many failed login attempts. Contact an administrator.');
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Increment failed login attempts
      await User.incrementLoginAttempts(username);
      return null;
    }

    // Reset login attempts and update last login on successful authentication
    await User.updateLastLogin(user.id);

    return user;
  }

  createSessionData(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
  }
}

module.exports = new AuthService();
