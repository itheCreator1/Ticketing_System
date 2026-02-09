const seedValidator = require('../../utils/seedValidator');

describe('Seed Validator', () => {
  describe('validateFloors', () => {
    it('should accept valid floor configuration', () => {
      const floors = [
        { name: 'Basement', sort_order: 0, active: true },
        { name: 'Ground Floor', sort_order: 1, active: true },
      ];
      const errors = seedValidator.validateFloors(floors);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array input', () => {
      const errors = seedValidator.validateFloors('not an array');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Expected array');
    });

    it('should reject empty floor array', () => {
      const errors = seedValidator.validateFloors([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('At least one floor is required');
    });

    it('should reject missing floor name', () => {
      const floors = [{ sort_order: 0, active: true }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Missing required field "name"'))).toBe(true);
    });

    it('should reject floor name that is too short', () => {
      const floors = [{ name: 'A', sort_order: 0, active: true }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Length must be between 2 and 50'))).toBe(true);
    });

    it('should reject floor name that is too long', () => {
      const floors = [{ name: 'A'.repeat(51), sort_order: 0, active: true }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Length must be between 2 and 50'))).toBe(true);
    });

    it('should reject duplicate floor names', () => {
      const floors = [
        { name: 'Basement', sort_order: 0, active: true },
        { name: 'Basement', sort_order: 1, active: true },
      ];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Duplicate floor name'))).toBe(true);
    });

    it('should reject missing sort_order', () => {
      const floors = [{ name: 'Basement', active: true }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Missing required field "sort_order"'))).toBe(true);
    });

    it('should reject non-integer sort_order', () => {
      const floors = [{ name: 'Basement', sort_order: 'not a number', active: true }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Must be an integer'))).toBe(true);
    });

    it('should reject negative sort_order', () => {
      const floors = [{ name: 'Basement', sort_order: -1, active: true }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Must be >= 0'))).toBe(true);
    });

    it('should reject duplicate sort_order values', () => {
      const floors = [
        { name: 'Basement', sort_order: 0, active: true },
        { name: 'Ground Floor', sort_order: 0, active: true },
      ];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Duplicate sort_order value'))).toBe(true);
    });

    it('should reject non-boolean active field', () => {
      const floors = [{ name: 'Basement', sort_order: 0, active: 'yes' }];
      const errors = seedValidator.validateFloors(floors);
      expect(errors.some((e) => e.includes('Must be a boolean'))).toBe(true);
    });
  });

  describe('validateDepartments', () => {
    const validFloors = [
      { name: 'Basement', sort_order: 0, active: true },
      { name: 'Ground Floor', sort_order: 1, active: true },
    ];

    it('should accept valid department configuration', () => {
      const departments = [
        {
          name: 'Emergency Department',
          description: 'Emergency services',
          floor: 'Ground Floor',
          user: {
            username: 'ed.coordinator',
            email: 'ed@hospital.local',
            password: 'password123',
            full_name: 'Dr. Sarah',
          },
        },
        {
          name: 'Internal',
          description: 'Admin only',
          floor: 'Ground Floor',
          user: null,
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array departments', () => {
      const errors = seedValidator.validateDepartments('not array', validFloors);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Expected array');
    });

    it('should reject empty department array', () => {
      const errors = seedValidator.validateDepartments([], validFloors);
      expect(errors.some((e) => e.includes('At least one department is required'))).toBe(true);
    });

    it('should reject missing Internal department', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed', email: 'ed@h.local', password: 'pass123', full_name: 'Ed' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('"Internal" department is required'))).toBe(true);
    });

    it('should reject duplicate Internal departments', () => {
      const departments = [
        { name: 'Internal', floor: 'Ground Floor', user: null },
        { name: 'Internal', floor: 'Ground Floor', user: null },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('can only be defined once'))).toBe(true);
    });

    it('should reject missing department name', () => {
      const departments = [{ floor: 'Ground Floor', user: null }];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Missing required field "name"'))).toBe(true);
    });

    it('should reject duplicate department names', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed1', email: 'ed1@h.local', password: 'pass123', full_name: 'Ed1' },
        },
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed2', email: 'ed2@h.local', password: 'pass123', full_name: 'Ed2' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Duplicate department name'))).toBe(true);
    });

    it('should reject department floor that does not exist', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Non-existent Floor',
          user: { username: 'ed', email: 'ed@h.local', password: 'pass123', full_name: 'Ed' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('does not exist in floors configuration'))).toBe(true);
    });

    it('should reject non-department with null user', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: null,
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('User is required for non-Internal departments'))).toBe(
        true
      );
    });

    it('should reject missing user username', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { email: 'ed@h.local', password: 'pass123', full_name: 'Ed' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Missing required field "username"'))).toBe(true);
    });

    it('should reject duplicate usernames', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed', email: 'ed1@h.local', password: 'pass123', full_name: 'Ed1' },
        },
        {
          name: 'Cardiology',
          floor: 'Ground Floor',
          user: { username: 'ed', email: 'ed2@h.local', password: 'pass123', full_name: 'Ed2' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Duplicate username'))).toBe(true);
    });

    it('should reject invalid email format', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed', email: 'invalid-email', password: 'pass123', full_name: 'Ed' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Invalid email format'))).toBe(true);
    });

    it('should reject duplicate emails', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed1', email: 'ed@h.local', password: 'pass123', full_name: 'Ed1' },
        },
        {
          name: 'Cardiology',
          floor: 'Ground Floor',
          user: { username: 'ed2', email: 'ed@h.local', password: 'pass123', full_name: 'Ed2' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Duplicate email'))).toBe(true);
    });

    it('should reject short password', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed', email: 'ed@h.local', password: 'short', full_name: 'Ed' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Must be at least 6 characters'))).toBe(true);
    });

    it('should reject missing full_name', () => {
      const departments = [
        {
          name: 'Emergency',
          floor: 'Ground Floor',
          user: { username: 'ed', email: 'ed@h.local', password: 'pass123' },
        },
      ];
      const errors = seedValidator.validateDepartments(departments, validFloors);
      expect(errors.some((e) => e.includes('Missing required field "full_name"'))).toBe(true);
    });
  });

  describe('validateSuperAdmin', () => {
    it('should accept valid super admin', () => {
      const superAdmin = {
        username: 'superadmin',
        email: 'admin@hospital.local',
        password: 'admin123',
        full_name: 'Administrator',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing super admin', () => {
      const errors = seedValidator.validateSuperAdmin(null);
      expect(errors.some((e) => e.includes('Super admin configuration is required'))).toBe(true);
    });

    it('should reject missing username', () => {
      const superAdmin = {
        email: 'admin@hospital.local',
        password: 'admin123',
        full_name: 'Administrator',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors.some((e) => e.includes('Missing required field "username"'))).toBe(true);
    });

    it('should reject missing email', () => {
      const superAdmin = {
        username: 'superadmin',
        password: 'admin123',
        full_name: 'Administrator',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors.some((e) => e.includes('Missing required field "email"'))).toBe(true);
    });

    it('should reject invalid email', () => {
      const superAdmin = {
        username: 'superadmin',
        email: 'invalid-email',
        password: 'admin123',
        full_name: 'Administrator',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors.some((e) => e.includes('Invalid email format'))).toBe(true);
    });

    it('should reject missing password', () => {
      const superAdmin = {
        username: 'superadmin',
        email: 'admin@hospital.local',
        full_name: 'Administrator',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors.some((e) => e.includes('Missing required field "password"'))).toBe(true);
    });

    it('should reject short password', () => {
      const superAdmin = {
        username: 'superadmin',
        email: 'admin@hospital.local',
        password: 'short',
        full_name: 'Administrator',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors.some((e) => e.includes('Must be at least 6 characters'))).toBe(true);
    });

    it('should reject missing full_name', () => {
      const superAdmin = {
        username: 'superadmin',
        email: 'admin@hospital.local',
        password: 'admin123',
      };
      const errors = seedValidator.validateSuperAdmin(superAdmin);
      expect(errors.some((e) => e.includes('Missing required field "full_name"'))).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate complete configuration', () => {
      const floorsData = {
        version: '1.0.0',
        floors: [
          { name: 'Basement', sort_order: 0, active: true },
          { name: 'Ground Floor', sort_order: 1, active: true },
        ],
      };

      const departmentsData = {
        version: '1.0.0',
        super_admin: {
          username: 'superadmin',
          email: 'admin@hospital.local',
          password: 'admin123',
          full_name: 'Admin',
        },
        departments: [
          {
            name: 'Emergency',
            description: 'Emergency services',
            floor: 'Ground Floor',
            user: {
              username: 'ed.coordinator',
              email: 'ed@h.local',
              password: 'pass123',
              full_name: 'Ed Coordinator',
            },
          },
          {
            name: 'Internal',
            description: 'Admin only',
            floor: 'Ground Floor',
            user: null,
          },
        ],
      };

      const result = seedValidator.validateConfig(floorsData, departmentsData);
      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all errors from all sections', () => {
      const floorsData = {
        floors: [{ sort_order: 0 }], // Missing name
      };

      const departmentsData = {
        super_admin: { username: 'admin' }, // Missing required fields
        departments: [{ name: 'Emergency' }], // Missing floor
      };

      const result = seedValidator.validateConfig(floorsData, departmentsData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject if floors missing', () => {
      const floorsData = { version: '1.0.0' };
      const departmentsData = { super_admin: {}, departments: [] };

      const result = seedValidator.validateConfig(floorsData, departmentsData);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Missing "floors" array');
    });

    it('should reject if departments missing', () => {
      const floorsData = { floors: [] };
      const departmentsData = { super_admin: {} };

      const result = seedValidator.validateConfig(floorsData, departmentsData);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing "departments" array'))).toBe(true);
    });
  });

  describe('formatErrors', () => {
    it('should format errors for display', () => {
      const errors = [
        'Floor[0]: Missing required field "name"',
        'Department[1]: floor "10th Floor" does not exist',
      ];

      const formatted = seedValidator.formatErrors(errors);
      expect(formatted).toContain('❌ Configuration validation failed');
      expect(formatted).toContain('Floor[0]: Missing required field "name"');
      expect(formatted).toContain('Department[1]: floor "10th Floor" does not exist');
      expect(formatted).toContain('Please fix the errors above and try again');
    });

    it('should return empty string for no errors', () => {
      const formatted = seedValidator.formatErrors([]);
      expect(formatted).toBe('');
    });
  });
});
