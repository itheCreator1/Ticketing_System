# Deployment Guide - KNII Ticketing System

This guide covers deploying the ticketing system in a production environment on your local server.

## Quick Start (Docker)

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your production settings

# 2. Start containers
docker-compose build
docker-compose up -d

# 3. Create admin user
docker-compose exec web npm run seed-admin
# Follow prompts or use the non-interactive method in section 4 below

# 4. Access the application
# Public: http://localhost:3000
# Admin: http://localhost:3000/auth/login
```

---

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (if running without Docker)
- PostgreSQL 16 (if running without Docker)
- Sufficient disk space for database and logs

---

## Production Deployment Options

### Option 1: Docker Deployment (Recommended)

#### 1. Prepare Environment

Copy the example environment file and configure for production:

```bash
cp .env.example .env
```

Edit `.env` with production values:

```bash
# IMPORTANT: Update these values for production!
NODE_ENV=production
PORT=3000

# Docker Configuration
DOCKER_COMMAND=npm start
RESTART_POLICY=unless-stopped

# Database - CHANGE THESE CREDENTIALS
POSTGRES_USER=ticketing_user
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE
POSTGRES_DB=ticketing_db
DB_PORT=5432
DATABASE_URL=postgres://ticketing_user:YOUR_STRONG_PASSWORD_HERE@db:5432/ticketing_db

# Session Secret - Generate with: openssl rand -base64 32
SESSION_SECRET=YOUR_GENERATED_SECRET_HERE
```

#### 2. Generate Secure Credentials

```bash
# Generate a strong session secret
openssl rand -base64 32

# Generate a strong database password
openssl rand -base64 24
```

#### 3. Build and Start Services

```bash
# Build the containers
docker-compose build

# Start in production mode
docker-compose up -d

# View logs to see initialization
docker-compose logs -f web
```

**The database will be automatically initialized on first startup!**

PostgreSQL automatically runs the SQL migration files from the `./migrations` folder on first startup, creating all necessary tables (users, tickets, comments, session).

#### 4. Initial Admin Setup

The system automatically creates a default super admin user on first startup:

**Default Super Admin Credentials:**
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@example.com`
- **Role**: `super_admin` (can manage other users)

⚠️ **CRITICAL SECURITY REQUIREMENT**:
1. Login immediately after deployment
2. Navigate to User Management and change the admin password
3. Use a strong password meeting these requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

#### 5. User Management Setup

After logging in as super admin:

1. **Access User Management**: Click "User Management" in the header
2. **Change Admin Password**:
   - Go to Edit → Reset Password
   - Enter a strong password
3. **Create Additional Users** (if needed):
   - Click "Create New User"
   - Set username, email, password, and role
   - Choose `admin` for regular admins or `super_admin` for user managers

**User Roles:**
- **admin**: Can manage tickets and comments only
- **super_admin**: All admin permissions + user management capabilities

#### 6. Verify Deployment

```bash
# Check service status
docker-compose ps

# Check application logs
docker-compose logs web

# Check database logs
docker-compose logs db

# Test the application
curl http://localhost:3000
```

#### 7. Access the Application

- **Public Ticket Submission**: `http://localhost:3000`
- **Admin Login**: `http://localhost:3000/auth/login`
- **Admin Dashboard**: `http://localhost:3000/admin/dashboard` (after login)
- **User Management**: `http://localhost:3000/admin/users` (super_admin only)

#### 8. Database Backups

```bash
# Create a backup directory (already mounted in docker-compose.yml)
mkdir -p backups

# Backup database
docker-compose exec db pg_dump -U ticketing_user ticketing_db > backups/backup-$(date +%Y%m%d-%H%M%S).sql

# Restore from backup
docker-compose exec -T db psql -U ticketing_user ticketing_db < backups/backup-YYYYMMDD-HHMMSS.sql
```

---

### Option 2: PM2 Deployment (Without Docker)

#### 1. Install Dependencies

```bash
npm install --production
```

#### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with production values (see Docker section above)
```

#### 3. Setup PostgreSQL

Install and configure PostgreSQL locally, then run migrations:

```bash
# Run migrations
npm run init-db

# Create admin user
npm run seed-admin
```

#### 4. Start with PM2

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start application in cluster mode
npm run prod

# Check status
pm2 status

# View logs
npm run prod:logs

# Monitor in real-time
npm run prod:monitor
```

#### 5. PM2 Process Management

```bash
# Restart application
npm run prod:restart

# Stop application
npm run prod:stop

# Start on system boot
pm2 startup
pm2 save
```

---

## Post-Deployment Tasks

### 1. Security Checklist

- [ ] Changed default database password
- [ ] Generated secure SESSION_SECRET (min 32 characters)
- [ ] Set NODE_ENV=production
- [ ] Enabled HTTPS (if using reverse proxy)
- [ ] Configured firewall to restrict database port access
- [ ] Reviewed Helmet security headers in index.js
- [ ] Disabled development tools (nodemon, source maps)
- [ ] Changed default admin password (admin/admin123)
- [ ] Created at least one backup super_admin account
- [ ] Tested account locking after failed login attempts
- [ ] Verified audit logging is working
- [ ] Reviewed user roles and permissions
- [ ] Disabled or removed any test/demo user accounts

### 2. Monitoring

#### Docker Monitoring
```bash
# View resource usage
docker stats

# View logs
docker-compose logs -f --tail=100

# Restart services
docker-compose restart web
```

#### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs ticketing-system

# Application metrics
pm2 show ticketing-system
```

### 3. Log Management

Logs are stored in:
- **Docker**: `docker-compose logs`
- **PM2**: `./logs/pm2-*.log`
- **Application**: Morgan logs to stdout/stderr

Implement log rotation:

```bash
# For PM2 logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Maintenance Tasks

### Database Maintenance

```bash
# Vacuum database (Docker)
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "VACUUM ANALYZE;"

# Check database size
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT pg_size_pretty(pg_database_size('ticketing_db'));"
```

### Update Application

```bash
# Pull latest changes
git pull origin main

# Docker deployment
docker-compose down
docker-compose build
docker-compose up -d

# PM2 deployment
npm install --production
npm run prod:restart
```

---

## Troubleshooting

### Issue: Application won't start

```bash
# Check logs
docker-compose logs web
# or
pm2 logs ticketing-system

# Verify environment variables
docker-compose exec web env | grep -E 'NODE_ENV|DATABASE_URL|SESSION_SECRET'
# or
cat .env
```

### Issue: Database connection fails

```bash
# Check database is running
docker-compose ps db

# Test database connection
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT 1;"

# Check DATABASE_URL format
# Should be: postgres://username:password@host:port/database
```

### Issue: Can't login to admin

```bash
# Verify admin user exists and check status
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT username, email, role, status, login_attempts FROM users;"

# Check if account is locked (login_attempts >= 5)
# If locked, reset login attempts:
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "UPDATE users SET login_attempts = 0 WHERE username = 'admin';"

# Check if account status is 'active'
# If not, activate the account:
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "UPDATE users SET status = 'active' WHERE username = 'admin';"
```

### Issue: User account locked after failed login attempts

When a user fails to login 5 times, their account is automatically locked for security.

```bash
# Check locked accounts
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT username, email, login_attempts FROM users WHERE login_attempts >= 5;"

# Unlock specific user account
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "UPDATE users SET login_attempts = 0 WHERE username = 'USERNAME';"

# Unlock all accounts (use with caution)
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "UPDATE users SET login_attempts = 0;"
```

### Issue: Can't access User Management page

Only users with `super_admin` role can access the User Management page.

```bash
# Check user role
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT username, role FROM users WHERE username = 'admin';"

# Upgrade user to super_admin
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "UPDATE users SET role = 'super_admin' WHERE username = 'admin';"
```

### Issue: Need to view audit logs

```bash
# View recent user management actions
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT al.created_at, u.username as actor, al.action, al.target_type, al.details FROM audit_logs al JOIN users u ON al.actor_id = u.id ORDER BY al.created_at DESC LIMIT 20;"

# View logs for specific user
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT * FROM audit_logs WHERE actor_id = (SELECT id FROM users WHERE username = 'admin') ORDER BY created_at DESC;"
```

### Issue: Out of disk space

```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a --volumes

# Clean old logs
rm -f logs/*.log
pm2 flush
```

---

## Scaling Considerations

### Horizontal Scaling (PM2 Cluster Mode)

PM2 automatically runs in cluster mode with `instances: 'max'` in `ecosystem.config.js`, utilizing all CPU cores.

### Database Connection Pool

Connection pool is configured in [config/database.js](config/database.js):
- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 2s

Adjust based on load:

```javascript
// config/database.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // Increase for higher load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Load Balancing

For multiple server instances, use nginx as a reverse proxy:

```nginx
upstream ticketing_backend {
  server localhost:3000;
  server localhost:3001;
  server localhost:3002;
}

server {
  listen 80;
  server_name tickets.yourdomain.com;

  location / {
    proxy_pass http://ticketing_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | development | Set to `production` for production |
| `PORT` | No | 3000 | Application port |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | - | Secret for session encryption (min 32 chars) |
| `POSTGRES_USER` | Docker only | ticketing_user | Database username |
| `POSTGRES_PASSWORD` | Docker only | - | Database password |
| `POSTGRES_DB` | Docker only | ticketing_db | Database name |
| `DOCKER_COMMAND` | Docker only | npm run dev | Command to run in container |
| `RESTART_POLICY` | Docker only | no | Docker restart policy |

---

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
