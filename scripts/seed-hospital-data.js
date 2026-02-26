/**
 * Hospital Department & User Seeder Script (Config-Driven)
 *
 * Reads from JSON configuration files (floors.json, departments.json) to populate:
 * - Floors (customizable for any building layout)
 * - Hospital departments (customizable)
 * - Department users (one per department)
 * - Super admin user
 *
 * Usage:
 *   npm run seed:hospital                       # Use default config
 *   npm run seed:hospital -- --clean            # Clean and reseed
 *   npm run seed:hospital -- --config-dir ./my-config  # Custom config
 *
 * Configuration Files:
 *   config/seed-data/floors.json                # Floor definitions
 *   config/seed-data/departments.json           # Departments and users
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const User = require('../models/User');
const Floor = require('../models/Floor');
const Department = require('../models/Department');
const seedValidator = require('../utils/seedValidator');
const readline = require('readline');

/**
 * Helper function to get user confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Load JSON configuration files
 * @returns {Object} { floorsData, departmentsData }
 */
function loadConfig() {
  const configDir = path.join(__dirname, '../config/seed-data');

  const floorsPath = path.join(configDir, 'floors.json');
  const departmentsPath = path.join(configDir, 'departments.json');

  // eslint-disable-next-line no-sync
  if (!fs.existsSync(floorsPath)) {
    throw new Error(`Floors configuration not found: ${floorsPath}`);
  }

  // eslint-disable-next-line no-sync
  if (!fs.existsSync(departmentsPath)) {
    throw new Error(`Departments configuration not found: ${departmentsPath}`);
  }

  try {
    // eslint-disable-next-line no-sync
    const floorsData = JSON.parse(fs.readFileSync(floorsPath, 'utf8'));
    // eslint-disable-next-line no-sync
    const departmentsData = JSON.parse(fs.readFileSync(departmentsPath, 'utf8'));

    return { floorsData, departmentsData };
  } catch (error) {
    throw new Error(`Failed to parse configuration files: ${error.message}`);
  }
}

/**
 * Validate configuration files
 * @param {Object} floorsData - Parsed floors.json
 * @param {Object} departmentsData - Parsed departments.json
 */
function validateConfiguration(floorsData, departmentsData) {
  const result = seedValidator.validateConfig(floorsData, departmentsData);

  if (!result.valid) {
    console.error('\n' + seedValidator.formatErrors(result.errors));
    process.exit(1);
  }

  console.log('✓ Configuration validation passed\n');
}

/**
 * Clean existing data from database
 */
async function cleanDatabase() {
  console.log('\n⚠️  WARNING: This will DELETE all existing tickets, comments, and users!');
  console.log('The following data will be removed:');
  console.log('  - All tickets and comments');
  console.log('  - All users (except "admin" if exists)');
  console.log('  - All non-system departments (Internal will be preserved)');
  console.log('  - All sessions\n');

  const confirmed = await askConfirmation('Are you sure you want to continue? (yes/no): ');

  if (!confirmed) {
    console.log('\n❌ Operation cancelled by user.\n');
    process.exit(0);
  }

  console.log('\n🧹 Cleaning existing data...');

  try {
    // Delete in correct order (respect foreign keys)
    await pool.query('DELETE FROM comments');
    console.log('   ✓ Removed comments');

    await pool.query('DELETE FROM tickets');
    console.log('   ✓ Removed tickets');

    await pool.query('DELETE FROM audit_logs');
    console.log('   ✓ Removed audit logs');

    // Keep original admin user if exists, remove all others
    await pool.query("DELETE FROM users WHERE username NOT IN ('admin')");
    console.log('   ✓ Removed users (kept admin if exists)');

    // Remove non-system departments (keep Internal)
    await pool.query('DELETE FROM departments WHERE is_system = false');
    console.log('   ✓ Removed non-system departments (kept Internal)');

    await pool.query('DELETE FROM session');
    console.log('   ✓ Cleared sessions');

    console.log('✓ Database cleaned successfully\n');
  } catch (error) {
    console.error('✗ Error cleaning database:', error.message);
    throw error;
  }
}

/**
 * Create floors from configuration
 */
async function createFloors(floorsConfig) {
  console.log('[1/4] Creating floors...');

  try {
    const createdFloors = [];

    for (const floorConfig of floorsConfig) {
      // Check if floor already exists
      const existing = await Floor.findByName(floorConfig.name);
      if (existing) {
        console.log(`   ⚠ Floor "${floorConfig.name}" already exists, skipping`);
        createdFloors.push(existing);
        continue;
      }

      const floor = await Floor.create({
        name: floorConfig.name,
        sort_order: floorConfig.sort_order,
      });

      createdFloors.push(floor);
      console.log(`   ✓ Created floor: ${floorConfig.name}`);
    }

    console.log(`   ✓ Total: ${createdFloors.length} floors ready\n`);
    return createdFloors;
  } catch (error) {
    console.error('   ✗ Error creating floors:', error.message);
    throw error;
  }
}

/**
 * Create super admin user from configuration
 */
async function createSuperAdmin(superAdminConfig) {
  console.log('[2/4] Creating super admin user...');

  try {
    // Check if super admin already exists
    const existing = await User.findByUsername(superAdminConfig.username);
    if (existing) {
      console.log(
        `   ⚠ Super admin "${superAdminConfig.username}" already exists, skipping creation`
      );
      return existing;
    }

    const superAdmin = await User.create({
      username: superAdminConfig.username,
      email: superAdminConfig.email,
      password: superAdminConfig.password,
      role: 'super_admin',
      department: null,
    });

    console.log(`   ✓ Super admin created: ${superAdminConfig.username}\n`);
    return superAdmin;
  } catch (error) {
    console.error('   ✗ Error creating super admin:', error.message);
    throw error;
  }
}

/**
 * Create hospital departments from configuration
 */
async function createDepartments(departmentsConfig) {
  console.log('[3/4] Creating departments from configuration...');

  try {
    const createdDepartments = [];

    for (const deptConfig of departmentsConfig) {
      // Check if department already exists
      const existing = await Department.findByName(deptConfig.name);
      if (existing) {
        console.log(`   ⚠ Department "${deptConfig.name}" already exists, skipping`);
        createdDepartments.push(deptConfig);
        continue;
      }

      // For Internal department, set is_system=true
      const isSystem = deptConfig.name === 'Internal';

      await Department.create({
        name: deptConfig.name,
        description: deptConfig.description,
        floor: deptConfig.floor,
        isSystem,
      });

      createdDepartments.push(deptConfig);
      console.log(`   ✓ Created department: ${deptConfig.name}`);
    }

    console.log(`   ✓ Total: ${createdDepartments.length} departments ready\n`);
    return createdDepartments;
  } catch (error) {
    console.error('   ✗ Error creating departments:', error.message);
    throw error;
  }
}

/**
 * Create department users (one per department that has a user defined)
 */
async function createDepartmentUsers(departmentsConfig) {
  console.log('[4/4] Creating department users...');

  try {
    const createdUsers = [];

    for (const deptConfig of departmentsConfig) {
      // Skip departments without users (e.g., Internal)
      if (!deptConfig.user) {
        console.log(`   ⚠ Department "${deptConfig.name}" has no user defined, skipping`);
        continue;
      }

      const userConfig = deptConfig.user;

      // Check if user already exists
      const existing = await User.findByUsername(userConfig.username);
      if (existing) {
        console.log(`   ⚠ User ${userConfig.username} already exists, skipping`);
        createdUsers.push({
          user: existing,
          deptName: deptConfig.name,
          fullName: userConfig.full_name,
        });
        continue;
      }

      const user = await User.create({
        username: userConfig.username,
        email: userConfig.email,
        password: userConfig.password,
        role: 'department',
        department: deptConfig.name,
      });

      createdUsers.push({
        user,
        deptName: deptConfig.name,
        fullName: userConfig.full_name,
      });
      console.log(
        `   ✓ Created user: ${userConfig.username} (${userConfig.full_name} - ${deptConfig.name})`
      );
    }

    console.log(`   ✓ Total: ${createdUsers.length} department users created\n`);
    return createdUsers;
  } catch (error) {
    console.error('   ✗ Error creating department users:', error.message);
    throw error;
  }
}

/**
 * Display login credentials
 */
function displayCredentials(superAdmin, users) {
  console.log('=== Seeding Complete! ===\n');
  console.log('Login credentials:\n');
  console.log('  Super Admin:');
  console.log(`    Username: ${superAdmin.username}`);
  console.log(`    Password: ${superAdmin.password}\n`);

  if (users.length > 0) {
    console.log('  Department Users:\n');
    for (const { user, deptName, fullName } of users) {
      console.log(`    ${deptName}:`);
      console.log(`      Name: ${fullName}`);
      console.log(`      Username: ${user.username}`);
      console.log('      Password: (from configuration)');
      console.log('');
    }
  }

  console.log('📝 Access the application at: http://localhost:3000/auth/login');
  console.log('💡 To add sample tickets and comments, run: npm run seed:sample\n');
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('=== KNII Ticketing System - Data Seeder (Config-Driven) ===\n');

  try {
    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');

    if (shouldClean) {
      await cleanDatabase();
    }

    // Load and validate configuration files
    console.log('Loading configuration files...');
    const { floorsData, departmentsData } = loadConfig();
    validateConfiguration(floorsData, departmentsData);

    // Phase 1: Create floors
    const floors = await createFloors(floorsData.floors);

    // Phase 2: Create super admin
    const superAdmin = await createSuperAdmin(departmentsData.super_admin);

    // Phase 3: Create hospital departments
    const departments = await createDepartments(departmentsData.departments);

    // Phase 4: Create department users
    const users = await createDepartmentUsers(departmentsData.departments);

    // Create audit log
    const stats = {
      floors: floors.length,
      users: users.length + 1, // +1 for super admin
      departments: departments.length,
      superAdmin: 1,
    };
    // Display login credentials
    displayCredentials(departmentsData.super_admin, users);

    console.log('✅ Seeding completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    if (error.message.includes('validation failed')) {
      // Validation errors already displayed
      process.exit(1);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the seeder
seedDatabase();
