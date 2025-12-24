function validatePassword(password) {
  const errors = [];

  // Minimum 8 characters
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Require uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Require lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Require number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Require special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  if (strength <= 2) return 'weak';
  if (strength <= 4) return 'medium';
  return 'strong';
}

module.exports = {
  validatePassword,
  getPasswordStrength
};
