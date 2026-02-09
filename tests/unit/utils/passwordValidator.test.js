/**
 * Password Validator Unit Tests
 *
 * Tests password validation and strength checking functions.
 * These are pure functions with no dependencies, making them easy to test.
 */

const { validatePassword, getPasswordStrength } = require('../../../utils/passwordValidator');
const { invalidPasswords: _invalidPasswords, validPasswords } = require('../../fixtures/users');

describe('passwordValidator', () => {
  describe('validatePassword', () => {
    describe('should reject invalid passwords', () => {
      it('should reject passwords under 8 characters', () => {
        // Arrange
        const password = 'Short1!';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });

      it('should reject passwords without uppercase letter', () => {
        // Arrange
        const password = 'nouppercase1!';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
      });

      it('should reject passwords without lowercase letter', () => {
        // Arrange
        const password = 'NOLOWERCASE1!';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
      });

      it('should reject passwords without number', () => {
        // Arrange
        const password = 'NoNumber!';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
      });

      it('should reject passwords without special character', () => {
        // Arrange
        const password = 'NoSpecial123';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one special character');
      });

      it('should return multiple errors for passwords with multiple violations', () => {
        // Arrange
        const password = 'short';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });

      it('should reject empty password', () => {
        // Arrange
        const password = '';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });
    });

    describe('should accept valid passwords', () => {
      it('should accept passwords meeting all requirements', () => {
        // Arrange
        const password = 'ValidPass123!';

        // Act
        const result = validatePassword(password);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept various special characters', () => {
        // Arrange
        const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'];

        // Act & Assert
        specialChars.forEach((char) => {
          const password = `Test123${char}`;
          const result = validatePassword(password);
          expect(result.isValid).toBe(true);
        });
      });

      it('should accept all fixture valid passwords', () => {
        // Arrange & Act & Assert
        validPasswords.forEach((password) => {
          const result = validatePassword(password);
          expect(result.isValid).toBe(true);
        });
      });
    });
  });

  describe('getPasswordStrength', () => {
    it('should return strong for 8-character passwords with full variety', () => {
      // Arrange
      const password = 'Pass123!';

      // Act
      const result = getPasswordStrength(password);

      // Assert
      expect(result).toBe('strong');
    });

    it('should return strong for 10-12 character passwords with variety', () => {
      // Arrange
      const password = 'Password123!';

      // Act
      const result = getPasswordStrength(password);

      // Assert
      expect(result).toBe('strong');
    });

    it('should return strong for long passwords with high entropy', () => {
      // Arrange
      const password = 'MyVeryStrong#Password123!';

      // Act
      const result = getPasswordStrength(password);

      // Assert
      expect(result).toBe('strong');
    });

    it('should return weak for passwords with minimal complexity', () => {
      // Arrange
      const password = 'password';

      // Act
      const result = getPasswordStrength(password);

      // Assert
      expect(result).toBe('weak');
    });

    it('should consider character variety in strength calculation', () => {
      // Arrange
      const weakPassword = 'aaaaaaaa';
      const strongPassword = 'Aa1!Bb2@Cc3#';

      // Act
      const weakResult = getPasswordStrength(weakPassword);
      const strongResult = getPasswordStrength(strongPassword);

      // Assert
      expect(weakResult).toBe('weak');
      expect(strongResult).toBe('strong');
    });
  });
});
