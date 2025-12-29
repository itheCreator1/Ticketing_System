const bcrypt = require('bcryptjs');
const User = require('../models/User');

class AuthService {
  async authenticate(username, password) {
    const user = await User.findByUsernameWithPassword(username);

    // Always perform a password comparison even if user doesn't exist
    // This prevents timing attacks that could enumerate valid usernames
    // Using a dummy hash that will never match but takes similar time
    const passwordToCompare = user?.password_hash || '$2a$10$invalidhashtopreventtimingattack1234567890123456';
    const isValidPassword = await bcrypt.compare(password, passwordToCompare);

    // If user doesn't exist, return null (but after doing the comparison)
    if (!user) {
      return null;
    }

    // Check if account is locked due to too many failed attempts
    // Return null instead of throwing error to prevent user enumeration
    if (user.login_attempts >= 5) {
      return null;
    }

    // Check if account is active
    // Return null instead of throwing error to prevent user enumeration
    if (user.status !== 'active') {
      return null;
    }

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
