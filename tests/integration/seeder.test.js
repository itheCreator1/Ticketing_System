const path = require('path');
const fs = require('fs');
const pool = require('../../config/database');
const User = require('../../models/User');
const Floor = require('../../models/Floor');
const Department = require('../../models/Department');
const seedValidator = require('../../utils/seedValidator');

describe('Seeder Integration Tests', () => {
  const testConfigDir = path.join(__dirname, '../../config/seed-data');

  beforeAll(async () => {
    // Ensure config files exist
    // eslint-disable-next-line no-sync
    expect(fs.existsSync(path.join(testConfigDir, 'floors.json'))).toBe(true);
    // eslint-disable-next-line no-sync
    expect(fs.existsSync(path.join(testConfigDir, 'departments.json'))).toBe(true);
  });

  /**
   * Helper: Load config files
   */
  function loadConfig() {
    const floorsPath = path.join(testConfigDir, 'floors.json');
    const departmentsPath = path.join(testConfigDir, 'departments.json');

    // eslint-disable-next-line no-sync
    const floorsData = JSON.parse(fs.readFileSync(floorsPath, 'utf8'));
    // eslint-disable-next-line no-sync
    const departmentsData = JSON.parse(fs.readFileSync(departmentsPath, 'utf8'));

    return { floorsData, departmentsData };
  }

  /**
   * Helper: Clean database (comprehensive cleanup respecting FK constraints)
   */
  async function cleanDatabase(client = null) {
    const db = client || pool;

    // Cleanup order respects FK constraints:
    // 1. Comments (depends on tickets and users)
    // 2. Tickets (depends on users and departments)
    // 3. Audit logs (depends on users)
    // 4. Users (depends on departments)
    // 5. Departments (depends on floors)
    // 6. Floors
    // 7. Session

    try {
      await db.query('DELETE FROM comments');
      await db.query('DELETE FROM tickets');
      await db.query('DELETE FROM audit_logs');
      await db.query("DELETE FROM users WHERE username NOT IN ('admin')");
      // Delete ALL departments (including system departments like Internal)
      await db.query('DELETE FROM departments WHERE name != $1', ['Internal']);
      await db.query('DELETE FROM departments WHERE name = $1', ['Internal']);
      // Delete ALL floors (migration 024 makes table empty for new installations)
      await db.query('DELETE FROM floors');
      await db.query('DELETE FROM session');
    } catch (error) {
      // If deletion fails, try more aggressive approach
      try {
        // For stubborn FK issues, clear in smaller groups with error handling
        await db.query('DELETE FROM comments').catch(() => {});
        await db.query('DELETE FROM tickets').catch(() => {});
        await db.query('DELETE FROM audit_logs').catch(() => {});
        await db.query("DELETE FROM users WHERE username NOT IN ('admin')").catch(() => {});
        await db.query('DELETE FROM departments').catch(() => {});
        await db.query('DELETE FROM floors').catch(() => {});
        await db.query('DELETE FROM session').catch(() => {});
      } catch (innerError) {
        console.error('Database cleanup warning (may be due to other tests):', innerError.message);
        throw error; // Re-throw original error
      }
    }
  }

  /**
   * Helper: Create floors from config
   */
  async function createFloors(floorsConfig, client = null) {
    const db = client || pool;
    const createdFloors = [];

    for (const floorConfig of floorsConfig) {
      const existing = await Floor.findByName(floorConfig.name);
      if (!existing) {
        const floor = await Floor.create(
          { name: floorConfig.name, sort_order: floorConfig.sort_order },
          db
        );
        createdFloors.push(floor);
      }
    }

    return createdFloors;
  }

  /**
   * Helper: Create super admin
   */
  async function createSuperAdmin(superAdminConfig, client = null) {
    const _db = client || pool;
    const existing = await User.findByUsername(superAdminConfig.username);
    if (existing) {
      return existing;
    }

    return User.create({
      username: superAdminConfig.username,
      email: superAdminConfig.email,
      password: superAdminConfig.password,
      role: 'super_admin',
      department: null,
    });
  }

  /**
   * Helper: Create departments
   */
  async function createDepartments(departmentsConfig, client = null) {
    const db = client || pool;
    const createdDepartments = [];

    for (const deptConfig of departmentsConfig) {
      const existing = await Department.findByName(deptConfig.name);
      if (!existing) {
        await Department.create(
          {
            name: deptConfig.name,
            description: deptConfig.description,
            floor: deptConfig.floor,
          },
          db
        );

        // If Internal department, manually set is_system=true
        if (deptConfig.name === 'Internal') {
          await db.query('UPDATE departments SET is_system = true WHERE name = $1', [
            deptConfig.name,
          ]);
        }

        createdDepartments.push(deptConfig);
      }
    }

    return createdDepartments;
  }

  /**
   * Helper: Create department users
   */
  async function createDepartmentUsers(departmentsConfig) {
    const createdUsers = [];

    for (const deptConfig of departmentsConfig) {
      if (!deptConfig.user) {
        continue;
      }

      const userConfig = deptConfig.user;
      const existing = await User.findByUsername(userConfig.username);
      if (!existing) {
        const user = await User.create({
          username: userConfig.username,
          email: userConfig.email,
          password: userConfig.password,
          role: 'department',
          department: deptConfig.name,
        });
        createdUsers.push({ user, deptName: deptConfig.name });
      }
    }

    return createdUsers;
  }

  describe('Configuration Loading and Validation', () => {
    it('should load valid configuration files', () => {
      const { floorsData, departmentsData } = loadConfig();

      expect(floorsData).toBeDefined();
      expect(floorsData.floors).toBeDefined();
      expect(Array.isArray(floorsData.floors)).toBe(true);

      expect(departmentsData).toBeDefined();
      expect(departmentsData.departments).toBeDefined();
      expect(Array.isArray(departmentsData.departments)).toBe(true);
    });

    it('should validate configuration files', () => {
      const { floorsData, departmentsData } = loadConfig();
      const result = seedValidator.validateConfig(floorsData, departmentsData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have at least 8 floors in config', () => {
      const { floorsData } = loadConfig();
      expect(floorsData.floors.length).toBeGreaterThanOrEqual(8);
    });

    it('should have at least 11 departments (10 + Internal)', () => {
      const { departmentsData } = loadConfig();
      expect(departmentsData.departments.length).toBeGreaterThanOrEqual(11);
    });

    it('should include Internal department in config', () => {
      const { departmentsData } = loadConfig();
      const internal = departmentsData.departments.find((d) => d.name === 'Internal');
      expect(internal).toBeDefined();
      expect(internal.user).toBeNull();
    });

    it('should have valid super admin in config', () => {
      const { departmentsData } = loadConfig();
      const superAdmin = departmentsData.super_admin;

      expect(superAdmin).toBeDefined();
      expect(superAdmin.username).toBeDefined();
      expect(superAdmin.email).toBeDefined();
      expect(superAdmin.password).toBeDefined();
      expect(superAdmin.full_name).toBeDefined();
    });
  });

  describe('Floor Creation', () => {
    beforeEach(async () => {
      await cleanDatabase();
    });

    it('should create floors from configuration', async () => {
      const { floorsData } = loadConfig();
      const created = await createFloors(floorsData.floors);

      expect(created.length).toBeGreaterThan(0);

      // Verify in database
      const allFloors = await Floor.findAll(true);
      expect(allFloors.length).toBeGreaterThanOrEqual(created.length);
    });

    it('should be idempotent - second run skips existing floors', async () => {
      const { floorsData } = loadConfig();

      const _created1 = await createFloors(floorsData.floors);
      const created2 = await createFloors(floorsData.floors);

      expect(created2.length).toBe(0); // Nothing new created
    });

    it('should preserve floor order by sort_order', async () => {
      const { floorsData } = loadConfig();
      await createFloors(floorsData.floors);

      const allFloors = await Floor.findAll(true);
      for (let i = 0; i < allFloors.length - 1; i++) {
        expect(allFloors[i].sort_order).toBeLessThanOrEqual(allFloors[i + 1].sort_order);
      }
    });
  });

  describe('Super Admin Creation', () => {
    beforeEach(async () => {
      await cleanDatabase();
    });

    it('should create super admin from configuration', async () => {
      const { departmentsData } = loadConfig();
      const superAdmin = await createSuperAdmin(departmentsData.super_admin);

      expect(superAdmin).toBeDefined();
      expect(superAdmin.username).toBe(departmentsData.super_admin.username);
      expect(superAdmin.email).toBe(departmentsData.super_admin.email);
      expect(superAdmin.role).toBe('super_admin');
      expect(superAdmin.department).toBeNull();
    });

    it('should be idempotent - second run returns existing admin', async () => {
      const { departmentsData } = loadConfig();

      const admin1 = await createSuperAdmin(departmentsData.super_admin);
      const admin2 = await createSuperAdmin(departmentsData.super_admin);

      expect(admin1.id).toBe(admin2.id);
    });

    it('should not expose password hash in returned user', async () => {
      const { departmentsData } = loadConfig();
      const superAdmin = await createSuperAdmin(departmentsData.super_admin);

      expect(superAdmin.password_hash).toBeUndefined();
    });
  });

  describe('Department Creation', () => {
    beforeEach(async () => {
      await cleanDatabase();
      const { floorsData } = loadConfig();
      await createFloors(floorsData.floors);
    });

    it('should create departments from configuration', async () => {
      const { departmentsData } = loadConfig();
      const created = await createDepartments(departmentsData.departments);

      expect(created.length).toBeGreaterThan(0);
    });

    it('should set is_system=true only for Internal department', async () => {
      const { departmentsData } = loadConfig();
      await createDepartments(departmentsData.departments);

      const internalDept = await Department.findByName('Internal');
      expect(internalDept.is_system).toBe(true);

      // Check other departments
      const emergencyDept = await Department.findByName('Emergency Department');
      expect(emergencyDept.is_system).toBe(false);
    });

    it('should be idempotent - second run skips existing departments', async () => {
      const { departmentsData } = loadConfig();

      const _created1 = await createDepartments(departmentsData.departments);
      const created2 = await createDepartments(departmentsData.departments);

      expect(created2.length).toBe(0); // Nothing new created
    });

    it('should verify all departments have valid floors', async () => {
      const { departmentsData } = loadConfig();
      await createDepartments(departmentsData.departments);

      for (const deptConfig of departmentsData.departments) {
        const dept = await Department.findByName(deptConfig.name);
        const floor = await Floor.findByName(dept.floor);
        expect(floor).toBeDefined();
      }
    });

    it('should include Internal department after seeding', async () => {
      const { departmentsData } = loadConfig();
      await createDepartments(departmentsData.departments);

      const internal = await Department.findByName('Internal');
      expect(internal).toBeDefined();
      expect(internal.is_system).toBe(true);
    });
  });

  describe('Department User Creation', () => {
    beforeEach(async () => {
      await cleanDatabase();
      const { floorsData, departmentsData } = loadConfig();
      await createFloors(floorsData.floors);
      await createDepartments(departmentsData.departments);
    });

    it('should create department users from configuration', async () => {
      const { departmentsData } = loadConfig();
      const created = await createDepartmentUsers(departmentsData.departments);

      expect(created.length).toBeGreaterThan(0);
    });

    it('should skip departments without users (Internal)', async () => {
      const { departmentsData } = loadConfig();
      const _created = await createDepartmentUsers(departmentsData.departments);

      // Internal department should not create a user
      const internalUser = await User.findByUsername('internal');
      expect(internalUser).toBeUndefined();
    });

    it('should assign users to correct departments', async () => {
      const { departmentsData } = loadConfig();
      const created = await createDepartmentUsers(departmentsData.departments);

      for (const { user, deptName } of created) {
        expect(user.department).toBe(deptName);
        expect(user.role).toBe('department');
      }
    });

    it('should be idempotent - second run skips existing users', async () => {
      const { departmentsData } = loadConfig();

      const _created1 = await createDepartmentUsers(departmentsData.departments);
      const created2 = await createDepartmentUsers(departmentsData.departments);

      expect(created2.length).toBe(0); // Nothing new created
    });

    it('should not expose password hash in returned users', async () => {
      const { departmentsData } = loadConfig();
      const created = await createDepartmentUsers(departmentsData.departments);

      for (const { user } of created) {
        expect(user.password_hash).toBeUndefined();
      }
    });
  });

  describe('Complete Seeding Workflow', () => {
    beforeEach(async () => {
      await cleanDatabase();
    });

    it('should complete end-to-end seeding successfully', async () => {
      const { floorsData, departmentsData } = loadConfig();

      // Phase 1: Create floors
      const floors = await createFloors(floorsData.floors);
      expect(floors.length).toBeGreaterThan(0);

      // Phase 2: Create super admin
      const superAdmin = await createSuperAdmin(departmentsData.super_admin);
      expect(superAdmin).toBeDefined();

      // Phase 3: Create departments
      const departments = await createDepartments(departmentsData.departments);
      expect(departments.length).toBeGreaterThan(0);

      // Phase 4: Create department users
      const users = await createDepartmentUsers(departmentsData.departments);
      expect(users.length).toBeGreaterThan(0);

      // Verify totals
      const allFloors = await Floor.findAll(true);
      const allDepartments = await Department.findAll(true);
      const allUsers = await pool.query('SELECT * FROM users WHERE role = $1', ['department']);

      expect(allFloors.length).toBeGreaterThan(0);
      expect(allDepartments.length).toBeGreaterThan(0);
      expect(allUsers.rows.length).toBeGreaterThan(0);
    });

    it('should be safe to run multiple times (idempotency)', async () => {
      const { floorsData, departmentsData } = loadConfig();

      // First run
      await createFloors(floorsData.floors);
      const _superAdmin = await createSuperAdmin(departmentsData.super_admin);
      await createDepartments(departmentsData.departments);
      const users1 = await createDepartmentUsers(departmentsData.departments);
      const userCount1 = users1.length;

      // Second run - should not create duplicates
      await createFloors(floorsData.floors);
      await createSuperAdmin(departmentsData.super_admin);
      await createDepartments(departmentsData.departments);
      const users2 = await createDepartmentUsers(departmentsData.departments);

      expect(users2.length).toBe(0); // No new users created

      // Verify total user count hasn't changed
      const allUsers = await pool.query('SELECT * FROM users WHERE role = $1', ['department']);
      expect(allUsers.rows.length).toBe(userCount1);
    });

    it('should verify configuration integrity after seeding', async () => {
      const { floorsData, departmentsData } = loadConfig();

      await createFloors(floorsData.floors);
      await createSuperAdmin(departmentsData.super_admin);
      await createDepartments(departmentsData.departments);
      await createDepartmentUsers(departmentsData.departments);

      // Verify all referenced floors exist
      for (const deptConfig of departmentsData.departments) {
        const dept = await Department.findByName(deptConfig.name);
        const floor = await Floor.findByName(dept.floor);
        expect(floor).toBeDefined();
      }

      // Verify super admin exists
      const superAdmin = await User.findByUsername(departmentsData.super_admin.username);
      expect(superAdmin).toBeDefined();
      expect(superAdmin.role).toBe('super_admin');

      // Verify Internal department is protected
      const internal = await Department.findByName('Internal');
      expect(internal.is_system).toBe(true);
    });
  });
});
