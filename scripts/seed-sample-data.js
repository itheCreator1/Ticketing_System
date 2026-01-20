/**
 * Sample Hospital Data Seeder Script
 *
 * Populates the database with realistic hospital sample data for testing:
 * - 1 super admin user
 * - 10 department users (one per hospital department)
 * - 20 tickets (2 per department user with hospital scenarios)
 * - Comments on tickets (mix of public and internal)
 *
 * Usage:
 *   node scripts/seed-sample-data.js          # Add sample data
 *   node scripts/seed-sample-data.js --clean  # Clean and reseed data
 */

require('dotenv').config();
const pool = require('../config/database');
const User = require('../models/User');
const Department = require('../models/Department');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const AuditLog = require('../models/AuditLog');

// Realistic hospital ticket data by department
const ticketData = {
  'Emergency Department': [
    {
      title: 'ED Workstation computer freezing',
      description: 'The main triage workstation in ED keeps freezing during patient check-in. This is causing delays in processing emergency patients and affecting patient care.',
      priority: 'critical',
      status: 'open'
    },
    {
      title: 'Ambulance radio system not receiving',
      description: 'Radio communication with incoming ambulances is intermittent. We are missing critical patient information before arrival, which impacts our emergency preparedness.',
      priority: 'high',
      status: 'in_progress'
    }
  ],
  'Cardiology': [
    {
      title: 'ECG machine calibration needed',
      description: 'The ECG machine in room 204 is showing erratic readings. This equipment needs immediate calibration or replacement to ensure accurate patient diagnostics.',
      priority: 'high',
      status: 'open'
    },
    {
      title: 'Cardiac monitoring system upgrade',
      description: 'Request to upgrade the cardiac monitoring software to the latest version for improved arrhythmia detection algorithms and better patient monitoring capabilities.',
      priority: 'medium',
      status: 'waiting_on_admin'
    }
  ],
  'Radiology': [
    {
      title: 'X-ray machine error code 503',
      description: 'The X-ray machine in Imaging Room 2 is displaying error code 503 and refusing to operate. This is severely limiting our imaging capacity for the day.',
      priority: 'critical',
      status: 'in_progress'
    },
    {
      title: 'PACS system slow performance',
      description: 'The Picture Archiving and Communication System (PACS) has been extremely slow when accessing patient images. This is delaying radiologist reviews and reports.',
      priority: 'high',
      status: 'open'
    }
  ],
  'Pharmacy': [
    {
      title: 'Medication dispensing system offline',
      description: 'The automated medication dispensing system is offline. We cannot access medications for patient orders without manual override, which is time-consuming and error-prone.',
      priority: 'critical',
      status: 'waiting_on_admin'
    },
    {
      title: 'Prescription printer jam issue',
      description: 'The prescription label printer keeps jamming. This is slowing down medication preparation and causing delays in patient discharges.',
      priority: 'medium',
      status: 'open'
    }
  ],
  'Laboratory': [
    {
      title: 'Blood analyzer calibration overdue',
      description: 'The main blood chemistry analyzer is showing a calibration overdue warning. We need this serviced immediately to maintain accurate test results.',
      priority: 'high',
      status: 'open'
    },
    {
      title: 'Lab information system integration error',
      description: 'The lab information system is not properly syncing results with the main EHR. Lab results are not appearing in patient charts automatically.',
      priority: 'high',
      status: 'in_progress'
    }
  ],
  'Surgery': [
    {
      title: 'Operating room temperature control malfunction',
      description: 'OR 3 temperature control system is not maintaining proper temperature. The room is too warm for surgical procedures and needs immediate attention.',
      priority: 'critical',
      status: 'open'
    },
    {
      title: 'Surgical scheduling system glitch',
      description: 'The surgical scheduling system is showing double-bookings for OR 5 next week. Need to resolve this scheduling conflict before it affects patient surgeries.',
      priority: 'medium',
      status: 'waiting_on_admin'
    }
  ],
  'Intensive Care Unit': [
    {
      title: 'Ventilator alarm system issue',
      description: 'The central alarm system for ventilators in ICU bed 7 is not triggering properly. This is a critical patient safety concern that needs immediate resolution.',
      priority: 'critical',
      status: 'in_progress'
    },
    {
      title: 'ICU monitoring station display flickering',
      description: 'The main monitoring station display in ICU is flickering intermittently. This makes it difficult for nurses to monitor critical patient vitals effectively.',
      priority: 'high',
      status: 'open'
    }
  ],
  'Patient Registration': [
    {
      title: 'Insurance verification system timeout',
      description: 'The insurance verification system keeps timing out when trying to verify patient coverage. This is causing long wait times for patient check-in.',
      priority: 'high',
      status: 'open'
    },
    {
      title: 'Patient portal password reset not working',
      description: 'Multiple patients reporting that the password reset function on the patient portal is not sending reset emails. This is preventing patient access to their records.',
      priority: 'medium',
      status: 'waiting_on_admin'
    }
  ],
  'Medical Records': [
    {
      title: 'EHR system slow document loading',
      description: 'The electronic health record system is taking 2-3 minutes to load patient documents. This is significantly impacting clinical workflow and patient care efficiency.',
      priority: 'high',
      status: 'in_progress'
    },
    {
      title: 'Medical records scanning backlog',
      description: 'The document scanner for old paper records is malfunctioning. We have a backlog of 500+ documents that need to be digitized and imported into the EHR.',
      priority: 'medium',
      status: 'open'
    }
  ],
  'Facilities Management': [
    {
      title: 'Emergency generator testing failure',
      description: 'The backup emergency generator failed its monthly test. This is a critical safety issue that must be resolved immediately to ensure patient safety during power outages.',
      priority: 'critical',
      status: 'open'
    },
    {
      title: 'Medical gas alarm system fault',
      description: 'The medical gas alarm panel is showing a fault code for the oxygen supply line on floor 3. Need immediate inspection to ensure patient safety.',
      priority: 'high',
      status: 'in_progress'
    }
  ]
};

// Sample comments for tickets
const commentTemplates = [
  { content: 'I have checked the issue and will work on it shortly.', visibility: 'public' },
  { content: 'Can you provide more details about when this started happening?', visibility: 'public' },
  { content: 'Internal note: This requires vendor coordination.', visibility: 'internal' },
  { content: 'This has been escalated to the appropriate team.', visibility: 'public' },
  { content: 'Internal: Similar issue reported last month - check ticket #42.', visibility: 'internal' }
];

/**
 * Clean existing data from database
 */
async function cleanDatabase() {
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
  console.log('[1/5] Creating super admin user...');

  try {
    // Check if super admin already exists
    const existing = await User.findByUsername('superadmin');
    if (existing) {
      console.log('   ⚠ Super admin already exists, skipping creation');
      return existing;
    }

    const superAdmin = await User.create({
      username: 'superadmin',
      email: 'superadmin@knii.local',
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
 * Load departments and create department users
 */
async function createDepartmentUsers() {
  console.log('\n[2/5] Loading departments...');

  try {
    // Get all active non-system departments
    const departments = await Department.findAll(false);

    if (departments.length === 0) {
      throw new Error('No departments found. Please run migrations first.');
    }

    console.log(`   ✓ Found ${departments.length} departments: ${departments.map(d => d.name).join(', ')}`);

    console.log('\n[3/5] Creating department users...');
    const users = [];

    for (const dept of departments) {
      // Create username from department name (e.g., "IT Support" -> "it.support")
      const username = dept.name.toLowerCase().replace(/\s+/g, '.');
      const email = `${username}@knii.local`;

      // Check if user already exists
      const existing = await User.findByUsername(username);
      if (existing) {
        console.log(`   ⚠ User ${username} already exists, skipping`);
        users.push({ user: existing, deptName: dept.name });
        continue;
      }

      const user = await User.create({
        username: username,
        email: email,
        password: 'password123',
        role: 'department',
        department: dept.name
      });

      users.push({ user, deptName: dept.name });
      console.log(`   ✓ Created user: ${username} (${dept.name})`);
    }

    return users;
  } catch (error) {
    console.error('   ✗ Error creating department users:', error.message);
    throw error;
  }
}

/**
 * Create tickets for each department user
 */
async function createTickets(users, superAdmin) {
  console.log('\n[4/5] Creating tickets (2 per user)...');

  try {
    const createdTickets = [];

    for (const { user, deptName } of users) {
      const deptTickets = ticketData[deptName];

      if (!deptTickets) {
        console.log(`   ⚠ No ticket data for ${deptName}, using generic tickets`);
        continue;
      }

      for (const ticketInfo of deptTickets) {
        const ticket = await Ticket.create({
          title: ticketInfo.title,
          description: ticketInfo.description,
          reporter_name: user.username,
          reporter_department: deptName,
          reporter_id: user.id,
          priority: ticketInfo.priority,
          status: ticketInfo.status,
          is_admin_created: false
        });

        createdTickets.push({ ticket, user, superAdmin });
      }
    }

    console.log(`   ✓ Created ${createdTickets.length} tickets`);
    return createdTickets;
  } catch (error) {
    console.error('   ✗ Error creating tickets:', error.message);
    throw error;
  }
}

/**
 * Add comments to tickets
 */
async function createComments(ticketData) {
  console.log('\n[5/5] Adding comments...');

  try {
    let commentCount = 0;

    for (const { ticket, user, superAdmin } of ticketData) {
      // Add 1-2 public comments from department user
      const numPublicComments = Math.floor(Math.random() * 2) + 1; // 1 or 2

      for (let i = 0; i < numPublicComments; i++) {
        const template = commentTemplates.find(t => t.visibility === 'public');
        await Comment.create({
          ticket_id: ticket.id,
          user_id: user.id,
          content: template.content,
          visibility_type: 'public'
        });
        commentCount++;
      }

      // Add 0-1 internal comments from super admin (50% chance)
      if (Math.random() > 0.5) {
        const template = commentTemplates.find(t => t.visibility === 'internal');
        await Comment.create({
          ticket_id: ticket.id,
          user_id: superAdmin.id,
          content: template.content,
          visibility_type: 'internal'
        });
        commentCount++;
      }
    }

    console.log(`   ✓ Added ${commentCount} comments`);
  } catch (error) {
    console.error('   ✗ Error creating comments:', error.message);
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
      action: 'SEED_SAMPLE_DATA',
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
  console.log('\n=== Sample Hospital Data Seeding Complete! ===\n');
  console.log('Login credentials:\n');
  console.log('  Super Admin:');
  console.log('    Username: superadmin');
  console.log('    Password: admin123\n');
  console.log('  Department Users:');

  for (const { user, deptName } of users) {
    console.log(`    ${deptName}:`);
    console.log(`      Username: ${user.username}`);
    console.log(`      Password: password123`);
  }

  console.log('\n📝 Access the application at: http://localhost:3000/auth/login\n');
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('=== KNII Ticketing System - Sample Hospital Data Seeder ===\n');

  try {
    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');

    if (shouldClean) {
      await cleanDatabase();
    }

    // Phase 1: Create super admin
    const superAdmin = await createSuperAdmin();

    // Phase 2 & 3: Load departments and create users
    const users = await createDepartmentUsers();

    // Phase 4: Create tickets
    const tickets = await createTickets(users, superAdmin);

    // Phase 5: Add comments
    await createComments(tickets);

    // Create audit log
    const stats = {
      users: users.length + 1, // +1 for super admin
      tickets: tickets.length,
      departments: users.length
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
