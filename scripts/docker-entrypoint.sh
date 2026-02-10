#!/bin/bash
set -e

echo "==================== Docker Entrypoint Script ===================="
echo "Starting KNII Ticketing System..."
echo ""

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
until nc -z db 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "✓ PostgreSQL is ready!"
echo ""

# Check if database tables are initialized
echo "Checking database initialization status..."
DB_INITIALIZED=$(PGPASSWORD=${POSTGRES_PASSWORD:-ticketing_pass} psql -h db -U ${POSTGRES_USER:-ticketing_user} -d ${POSTGRES_DB:-ticketing_db} -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');" 2>/dev/null || echo "false")

if [ "$DB_INITIALIZED" = "t" ]; then
  echo "✓ Database tables already exist"
else
  echo "Database not initialized. Running migrations..."
  node scripts/init-db.js
  echo "✓ Database initialized successfully"
fi

echo ""
echo "Checking for admin user..."

# Always check for admin user, regardless of table existence
ADMIN_EXISTS=$(PGPASSWORD=${POSTGRES_PASSWORD:-ticketing_pass} psql -h db -U ${POSTGRES_USER:-ticketing_user} -d ${POSTGRES_DB:-ticketing_db} -tAc "SELECT EXISTS (SELECT FROM users WHERE role = 'admin' OR role = 'super_admin' LIMIT 1);" 2>/dev/null || echo "false")

if [ "$ADMIN_EXISTS" = "f" ]; then
  echo "No admin user found. Creating default admin user..."
  echo ""

  # Create default admin user with random secure password
  node -e "
    const crypto = require('crypto');
    const User = require('./models/User');

    function generateSecurePassword() {
      const base = crypto.randomBytes(24).toString('base64url').slice(0, 16);
      return base + 'A1a!';
    }

    (async () => {
      try {
        const password = generateSecurePassword();
        await User.create({
          username: 'admin',
          email: 'admin@example.com',
          password: password,
          role: 'super_admin'
        });
        console.log('');
        console.log('==============================================================');
        console.log('  DEFAULT ADMIN ACCOUNT CREATED');
        console.log('==============================================================');
        console.log('  Username: admin');
        console.log('  Password: ' + password);
        console.log('  Email:    admin@example.com');
        console.log('==============================================================');
        console.log('  WARNING: SAVE THIS PASSWORD NOW - it will NOT be shown again!');
        console.log('  Change it immediately after first login.');
        console.log('==============================================================');
        console.log('');
      } catch (error) {
        console.error('Error creating admin user:', error.message);
      } finally {
        process.exit(0);
      }
    })();
  "
else
  echo "✓ Admin user already exists"
fi

echo ""
echo "==================== Starting Application ===================="
echo ""

# Execute the main command
exec "$@"
