require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');

async function initDatabase() {
  const migrationFiles = [
    '001_create_users.sql',
    '002_create_tickets.sql',
    '003_create_comments.sql',
    '004_create_sessions.sql',
    '005_enhance_users_table.sql',
    '006_create_audit_logs.sql',
    '007_add_unset_priority.sql',
    '008_modify_ticket_reporter_fields.sql',
    '009_remove_is_internal.sql',
    '010_add_department_role.sql',
    '011_add_workflow_statuses.sql',
    '012_add_reporter_id_to_tickets.sql',
    '013_add_user_department_column.sql',
    '014_add_internal_department.sql',
    '015_add_is_admin_created_flag.sql',
    '016_create_departments_table.sql',
    '017_remove_reporter_desk.sql',
    '018_increase_status_column_length.sql',
    '019_add_comment_visibility.sql',
    '020_add_department_floor.sql',
    '021_fix_audit_log_fk_constraint.sql',
    '022_create_floors_table.sql',
    '023_convert_floor_to_fk.sql',
    '024_remove_hardcoded_system_floors.sql'
  ];

  try {
    console.log('Starting database initialization...');

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, '../migrations', file);
      const sql = await fs.readFile(filePath, 'utf8');

      console.log(`Running migration: ${file}`);
      await pool.query(sql);
      console.log(`✓ Completed: ${file}`);
    }

    console.log('\nDatabase initialization completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    await pool.end();
    process.exit(1);
  }
}

initDatabase();
