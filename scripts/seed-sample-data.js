/**
 * Sample Data Seeder Script
 *
 * Populates the database with realistic sample data for testing:
 * - 1 super admin user
 * - 5 department users (one per department)
 * - 10 tickets (2 per department user)
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

// Realistic ticket data by department
const ticketData = {
  'IT Support': [
    {
      title: 'Laptop not connecting to network',
      description: 'My laptop cannot connect to the office WiFi network. I have tried restarting it but the issue persists. This is blocking my work.',
      priority: 'high',
      status: 'open'
    },
    {
      title: 'Software installation request',
      description: 'I need Adobe Acrobat Pro installed on my workstation for PDF editing. Please install at your earliest convenience.',
      priority: 'medium',
      status: 'in_progress'
    }
  ],
  'General Support': [
    {
      title: 'Password reset needed',
      description: 'I forgot my password and need it reset. My username is the same as my email.',
      priority: 'medium',
      status: 'open'
    },
    {
      title: 'Access badge not working',
      description: 'My office access badge stopped working this morning. I cannot access the building.',
      priority: 'critical',
      status: 'waiting_on_admin'
    }
  ],
  'Human Resources': [
    {
      title: 'Benefits enrollment question',
      description: 'I have questions about the new benefits enrollment period. When is the deadline and what are my options?',
      priority: 'low',
      status: 'open'
    },
    {
      title: 'PTO request issue',
      description: 'I submitted a PTO request two weeks ago but have not received approval. Can you please check the status?',
      priority: 'medium',
      status: 'closed'
    }
  ],
  'Finance': [
    {
      title: 'Invoice processing delay',
      description: 'Several invoices submitted last week have not been processed yet. This is affecting our vendor relationships.',
      priority: 'high',
      status: 'in_progress'
    },
    {
      title: 'Budget report access needed',
      description: 'I need access to the Q4 budget reports for my department. Please grant access to the shared folder.',
      priority: 'medium',
      status: 'waiting_on_admin'
    }
  ],
  'Facilities': [
    {
      title: 'Office AC not working',
      description: 'The air conditioning in conference room B is not working. The room is very hot and uncomfortable for meetings.',
      priority: 'high',
      status: 'open'
    },
    {
      title: 'Meeting room booking issue',
      description: 'The online meeting room booking system is showing errors when I try to book room A for next week.',
      priority: 'low',
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
  console.log('\n=== Sample Data Seeding Complete! ===\n');
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
  console.log('=== KNII Ticketing System - Sample Data Seeder ===\n');

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
