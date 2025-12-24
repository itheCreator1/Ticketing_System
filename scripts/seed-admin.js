require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function seedAdmin() {
  try {
    console.log('Create Admin User\n');

    const username = await question('Username: ');
    const email = await question('Email: ');
    const password = await question('Password: ');

    if (!username || !email || !password) {
      console.error('All fields are required!');
      rl.close();
      await pool.end();
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, password_hash, 'admin']
    );

    const user = result.rows[0];

    console.log('\nAdmin user created successfully!');
    console.log(`ID: ${user.id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);

    rl.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin user:', error.message);
    rl.close();
    await pool.end();
    process.exit(1);
  }
}

seedAdmin();
