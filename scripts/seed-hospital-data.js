/**
 * Hospital Department & User Seeder Script
 *
 * Populates the database with hospital-specific departments and users:
 * - 10 hospital departments (Emergency, Cardiology, Radiology, etc.)
 * - 1 department user per department (realistic hospital staff names)
 * - 1 super admin user
 *
 * Usage:
 *   node scripts/seed-hospital-data.js          # Add hospital data
 *   node scripts/seed-hospital-data.js --clean  # Clean and reseed data
 */

require('dotenv').config();
const pool = require('../config/database');
const User = require('../models/User');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const readline = require('readline');

// Hospital departments configuration
const hospitalDepartments = [
  {
    name: 'Emergency Department',
    description: 'Emergency and urgent care services (ED)',
    floor: 'Ground Floor',
    username: 'ed.coordinator',
    email: 'ed.coordinator@hospital.local',
    fullName: 'Dr. Sarah Martinez'
  },
  {
    name: 'Cardiology',
    description: 'Cardiovascular and heart care services',
    floor: '3rd Floor',
    username: 'cardiology.nurse',
    email: 'cardiology.nurse@hospital.local',
    fullName: 'James Anderson'
  },
  {
    name: 'Radiology',
    description: 'Medical imaging and diagnostic radiology',
    floor: '2nd Floor',
    username: 'radiology.tech',
    email: 'radiology.tech@hospital.local',
    fullName: 'Dr. Emily Chen'
  },
  {
    name: 'Pharmacy',
    description: 'Pharmaceutical services and medication management',
    floor: '1st Floor',
    username: 'pharmacy.director',
    email: 'pharmacy.director@hospital.local',
    fullName: 'Robert Williams'
  },
  {
    name: 'Laboratory',
    description: 'Clinical laboratory and pathology services',
    floor: '1st Floor',
    username: 'lab.supervisor',
    email: 'lab.supervisor@hospital.local',
    fullName: 'Dr. Lisa Thompson'
  },
  {
    name: 'Surgery',
    description: 'Operating room and surgical services',
    floor: '4th Floor',
    username: 'surgery.coordinator',
    email: 'surgery.coordinator@hospital.local',
    fullName: 'Dr. Michael Brown'
  },
  {
    name: 'Intensive Care Unit',
    description: 'Critical care and ICU services',
    floor: '5th Floor',
    username: 'icu.charge.nurse',
    email: 'icu.charge.nurse@hospital.local',
    fullName: 'Jennifer Davis'
  },
  {
    name: 'Patient Registration',
    description: 'Patient admissions, registration, and scheduling',
    floor: 'Ground Floor',
    username: 'registration.lead',
    email: 'registration.lead@hospital.local',
    fullName: 'Maria Garcia'
  },
  {
    name: 'Medical Records',
    description: 'Health information management and medical records',
    floor: '6th Floor',
    username: 'records.manager',
    email: 'records.manager@hospital.local',
    fullName: 'David Lee'
  },
  {
    name: 'Facilities Management',
    description: 'Building maintenance, equipment, and operations',
    floor: 'Basement',
    username: 'facilities.director',
    email: 'facilities.director@hospital.local',
    fullName: 'Thomas Johnson'
  }
];

/**
 * Helper function to get user confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
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
 * Create super admin user
 */
async function createSuperAdmin() {
  console.log('[1/3] Creating super admin user...');

  try {
    // Check if super admin already exists
    const existing = await User.findByUsername('superadmin');
    if (existing) {
      console.log('   ⚠ Super admin already exists, skipping creation');
      return existing;
    }

    const superAdmin = await User.create({
      username: 'superadmin',
      email: 'superadmin@hospital.local',
      password: 'admin123',
      role: 'super_admin',
      department: null
    });

    console.log('   ✓ Super admin created: superadmin');
    return superAdmin;
  } catch (error) {
    console.error('   ✗ Error creating super admin:', error.message);
    throw error;
  }
}

/**
 * Create hospital departments
 */
async function createDepartments() {
  console.log('\n[2/3] Creating hospital departments...');

  try {
    const createdDepartments = [];

    for (const dept of hospitalDepartments) {
      // Check if department already exists
      const existing = await Department.findByName(dept.name);
      if (existing) {
        console.log(`   ⚠ Department "${dept.name}" already exists, skipping`);
        createdDepartments.push(dept);
        continue;
      }

      await Department.create({
        name: dept.name,
        description: dept.description,
        floor: dept.floor
      });

      createdDepartments.push(dept);
      console.log(`   ✓ Created department: ${dept.name}`);
    }

    console.log(`   ✓ Total: ${createdDepartments.length} departments ready`);
    return createdDepartments;
  } catch (error) {
    console.error('   ✗ Error creating departments:', error.message);
    throw error;
  }
}

/**
 * Create department users (one per department)
 */
async function createDepartmentUsers(departments) {
  console.log('\n[3/3] Creating department users (1 per department)...');

  try {
    const createdUsers = [];

    for (const dept of departments) {
      // Check if user already exists
      const existing = await User.findByUsername(dept.username);
      if (existing) {
        console.log(`   ⚠ User ${dept.username} already exists, skipping`);
        createdUsers.push({ user: existing, deptName: dept.name, fullName: dept.fullName });
        continue;
      }

      const user = await User.create({
        username: dept.username,
        email: dept.email,
        password: 'password123',
        role: 'department',
        department: dept.name
      });

      createdUsers.push({ user, deptName: dept.name, fullName: dept.fullName });
      console.log(`   ✓ Created user: ${dept.username} (${dept.fullName} - ${dept.name})`);
    }

    console.log(`   ✓ Total: ${createdUsers.length} department users created`);
    return createdUsers;
  } catch (error) {
    console.error('   ✗ Error creating department users:', error.message);
    throw error;
  }
}

/**
 * Create audit log entry for seeding operation
 */
async function createAuditLog(superAdmin, stats) {
  try {
    await AuditLog.create({
      actorId: superAdmin.id,
      action: 'SEED_HOSPITAL_DATA',
      targetType: 'system',
      targetId: null,
      details: stats,
      ipAddress: '127.0.0.1'
    });
  } catch (error) {
    console.error('   ⚠ Warning: Could not create audit log:', error.message);
  }
}

/**
 * Display login credentials
 */
function displayCredentials(users) {
  console.log('\n=== Hospital Data Seeding Complete! ===\n');
  console.log('Login credentials:\n');
  console.log('  Super Admin:');
  console.log('    Username: superadmin');
  console.log('    Password: admin123\n');
  console.log('  Department Users:\n');

  for (const { user, deptName, fullName } of users) {
    console.log(`    ${deptName}:`);
    console.log(`      Name: ${fullName}`);
    console.log(`      Username: ${user.username}`);
    console.log(`      Password: password123`);
    console.log('');
  }

  console.log('📝 Access the application at: http://localhost:3000/auth/login');
  console.log('💡 To add sample tickets and comments, run: npm run seed:sample\n');
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('=== KNII Ticketing System - Hospital Data Seeder ===\n');

  try {
    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');

    if (shouldClean) {
      await cleanDatabase();
    }

    // Phase 1: Create super admin
    const superAdmin = await createSuperAdmin();

    // Phase 2: Create hospital departments
    const departments = await createDepartments();

    // Phase 3: Create department users
    const users = await createDepartmentUsers(departments);

    // Create audit log
    const stats = {
      users: users.length + 1, // +1 for super admin
      departments: departments.length,
      superAdmin: 1
    };
    await createAuditLog(superAdmin, stats);

    // Display login credentials
    displayCredentials(users);

    console.log('✅ Seeding completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the seeder
seedDatabase();
