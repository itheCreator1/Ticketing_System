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
    '006_create_audit_logs.sql'
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
