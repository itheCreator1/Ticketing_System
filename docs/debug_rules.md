# Debugging & Troubleshooting Rules - KNII Ticketing System

**Version:** 1.0
**Last Updated:** December 2025
**Target Project:** KNII Ticketing System (Node.js 20 + Express 5 + PostgreSQL 16)

---

## Table of Contents

1. [How to Use This Document](#how-to-use-this-document)
2. [Global Debugging Principles](#global-debugging-principles-mandatory)
3. [Current Debugging Infrastructure](#current-debugging-infrastructure)
4. [Logging Best Practices](#logging-best-practices)
5. [Error Handling & Debugging Flow](#error-handling--debugging-flow)
6. [Development Debugging Workflows](#development-debugging-workflows)
7. [Production Debugging](#production-debugging)
8. [Security-Related Debugging](#security-related-debugging)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Performance Debugging](#performance-debugging)
11. [Debugging Tools & Commands Reference](#debugging-tools--commands-reference)
12. [Debugging Specific Components](#debugging-specific-components)
13. [Debugging Checklists](#debugging-checklists)
14. [Advanced Debugging Topics](#advanced-debugging-topics)

---

## How to Use This Document

You are Claude Code operating with full access to the KNII Ticketing System debugging infrastructure.

Your primary responsibility is to ensure effective debugging practices, rapid issue resolution, and comprehensive observability throughout the entire lifecycle of the project.

You MUST actively use logging, error tracking, and debugging tools to identify and resolve issues quickly and effectively.

### For Debugging Development Issues

1. Start with [Development Debugging Workflows](#development-debugging-workflows)
2. Check [Common Issues & Solutions](#common-issues--solutions) for known problems
3. Review [Logging Best Practices](#logging-best-practices) for proper instrumentation
4. Reference [Debugging Tools & Commands Reference](#debugging-tools--commands-reference) for quick commands

### For Production Troubleshooting

1. Begin with [Production Debugging](#production-debugging) for PM2 and log access
2. Review [Security-Related Debugging](#security-related-debugging) for auth/session issues
3. Check [Performance Debugging](#performance-debugging) for slow endpoints
4. Use [Debugging Checklists](#debugging-checklists) for systematic investigation

### For Understanding Logging Infrastructure

1. Read [Current Debugging Infrastructure](#current-debugging-infrastructure) for Winston/Morgan setup
2. Study [Logging Best Practices](#logging-best-practices) for proper usage patterns
3. Review [Error Handling & Debugging Flow](#error-handling--debugging-flow) for error architecture

### For Test Debugging

- See [docs/testing_rules.md](testing_rules.md) for comprehensive test debugging practices
- Cross-reference with [Debugging Specific Components](#debugging-specific-components) for component-level debugging

### Quick Search Tips

- Use Ctrl/Cmd+F to search for specific error messages, commands, or issues
- All section headers are linked in the Table of Contents
- Code examples are tagged with `// CORRECT` or `// INCORRECT`
- SQL queries include explanatory comments
- Bash commands include inline comments

---

## Global Debugging Principles (Mandatory)

1. **Log with Context**: Every log statement must include relevant context (user ID, operation, resource ID, error stack)
2. **Use Structured Logging**: Always use the Winston logger with metadata objects, never bare console.log in application code
3. **Log at Appropriate Levels**: error for failures, warn for anomalies, info for significant events, debug for detailed traces
4. **Preserve Error Stacks**: Always include `error.stack` in error logs for full context
5. **Avoid Logging Sensitive Data**: Never log passwords, tokens, session IDs, or personally identifiable information (PII)
6. **Debug Systematically**: Follow error flow from route → service → model → database before making assumptions
7. **Test in Isolation**: When debugging, isolate components and test with minimal dependencies
8. **Use Read-Only Queries in Production**: Never run destructive database queries when debugging production issues
9. **Document Unusual Findings**: If you discover undocumented behavior, add comments or update documentation
10. **Validate Assumptions**: Always verify assumptions with actual logs, queries, or debug output

---

## Current Debugging Infrastructure

### Winston Logger Configuration

**Location**: `utils/logger.js`

**Configuration**:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',  // error | warn | info | debug
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'knii-ticketing' },
  transports: [
    // Error log - errors only
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,  // 5MB
      maxFiles: 5
    }),
    // Combined log - all levels
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,  // 5MB
      maxFiles: 5
    })
  ]
});

// Development: add console output with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
```

**Log Levels** (in order of severity):
1. **error** (0): Application errors, exceptions, critical failures
2. **warn** (1): Warning conditions, potential issues, degraded performance
3. **info** (2): Significant application events, startup, shutdown
4. **debug** (3): Detailed debugging information, trace logs

**File Transports**:
- `logs/error.log` - Error level only (failures, exceptions)
- `logs/combined.log` - All log levels (complete application log)
- **Rotation**: 5MB max file size, 5 files retained (25MB total per log type)

**Environment Variables**:
- `LOG_LEVEL` - Controls Winston verbosity (default: 'info')
- `NODE_ENV` - Determines console output (development) vs file-only (production)

### Morgan HTTP Logging

**Location**: `index.js`

**Configuration**:
```javascript
const morgan = require('morgan');

// HTTP request logging with 'combined' format
app.use(morgan('combined'));
```

**Format**: Combined format includes:
- Remote address (IP)
- Date/time
- HTTP method and URL
- HTTP version
- Status code
- Response size
- Referrer
- User agent
- Response time

**Example Output**:
```
::1 - - [30/Dec/2025:10:15:32 +0000] "GET /admin/dashboard HTTP/1.1" 200 5432 "-" "Mozilla/5.0 ..."
```

### Log File Locations

**Development** (Docker):
- Console output: `docker-compose logs -f web`
- Files not typically used in development

**Production** (PM2):
- Winston logs: `/path/to/app/logs/error.log` and `/path/to/app/logs/combined.log`
- PM2 logs: `~/.pm2/logs/ticketing-system-out.log` and `ticketing-system-error.log`
- Access: `pm2 logs ticketing-system`

### Database Pool Error Handler

**Location**: `config/database.js`

```javascript
const logger = require('../utils/logger');

pool.on('error', (err) => {
  logger.error('Unexpected database error', {
    error: err.message,
    stack: err.stack
  });
});
```

Catches unexpected errors from idle PostgreSQL clients in the connection pool.

### Global Error Handler

**Location**: `middleware/errorHandler.js`

```javascript
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error caught by global handler', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    status: err.status || 500
  });

  const statusCode = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  if (req.xhr || req.headers.accept.includes('json')) {
    return res.status(statusCode).json({ error: message });
  }

  res.status(statusCode).render('errors/500', {
    message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
}
```

**Features**:
- Logs all caught errors with full context
- Environment-aware error messages (generic in production, detailed in development)
- Supports both HTML and JSON responses

---

## Logging Best Practices

### When to Use Each Log Level

#### error (Critical Issues)

Use for application failures that require immediate attention:

```javascript
// CORRECT - Database operation failed
try {
  await pool.query('INSERT INTO tickets ...');
} catch (error) {
  logger.error('Failed to create ticket', {
    error: error.message,
    stack: error.stack,
    userId: req.session.user.id,
    ticketData: { title, priority }
  });
  throw error;
}

// CORRECT - Authentication failure with security implications
logger.error('Multiple failed login attempts - possible brute force', {
  username,
  attempts: user.login_attempts,
  ip: req.ip
});

// INCORRECT - Using for expected validation failures
logger.error('User entered invalid email');  // This should be 'warn' or not logged at all
```

#### warn (Potential Issues)

Use for concerning conditions that don't stop execution:

```javascript
// CORRECT - Rate limit approached
logger.warn('User approaching rate limit', {
  userId: req.session.user.id,
  endpoint: req.path,
  requestCount: 8  // Out of 10 allowed
});

// CORRECT - Using fallback value
logger.warn('SESSION_SECRET not set, using insecure fallback', {
  environment: process.env.NODE_ENV
});

// INCORRECT - Using for normal operations
logger.warn('User logged in successfully');  // This should be 'info'
```

#### info (Significant Events)

Use for important application events and state changes:

```javascript
// CORRECT - Application lifecycle events
logger.info('Server started', {
  port: PORT,
  environment: process.env.NODE_ENV
});

// CORRECT - Significant user actions
logger.info('User logged in', {
  userId: user.id,
  username: user.username,
  ip: req.ip
});

// CORRECT - Important business events
logger.info('Ticket assigned', {
  ticketId: ticket.id,
  assignedTo: adminId,
  assignedBy: req.session.user.id
});

// INCORRECT - Logging every request (use Morgan for HTTP logging)
logger.info('GET /admin/dashboard');  // Redundant with Morgan
```

#### debug (Detailed Traces)

Use for detailed debugging information (disabled by default, enable with `LOG_LEVEL=debug`):

```javascript
// CORRECT - Tracing complex logic flow
logger.debug('Validation chain executed', {
  field: 'email',
  value: sanitizedEmail,
  rules: ['isEmail', 'normalizeEmail']
});

// CORRECT - Inspecting internal state
logger.debug('Session data', {
  sessionId: req.sessionID,
  user: req.session.user,
  regenerated: true
});

// INCORRECT - Logging sensitive data even at debug level
logger.debug('Password hash comparison', {
  password: password,  // NEVER log passwords!
  hash: user.password_hash  // NEVER log hashes!
});
```

### Structured Logging Patterns

Always use metadata objects for context:

```javascript
// CORRECT - Structured logging with context
logger.error('Failed to update user', {
  error: error.message,
  stack: error.stack,
  userId: targetUserId,
  changes: { status: 'inactive' },
  actor: req.session.user.id,
  ip: req.ip
});

// INCORRECT - Unstructured string concatenation
logger.error(`Failed to update user ${targetUserId}: ${error.message}`);
// Problems: Hard to parse, can't filter by userId, no stack trace
```

### Context to Include in Logs

**Always Include**:
- `error.message` - Error description
- `error.stack` - Full stack trace for errors
- Operation identifier (e.g., 'updateUser', 'createTicket')

**Usually Include**:
- `userId` or `req.session.user.id` - Who performed the action
- `ip` or `req.ip` - Source IP address
- Resource IDs (`ticketId`, `commentId`, `targetUserId`)
- Relevant operation parameters (excluding sensitive data)

**Sometimes Include**:
- `method` and `url` - HTTP request details (if not already in Morgan logs)
- `timestamp` - Included automatically by Winston
- `sessionId` - For session-specific debugging

**Never Include**:
- Passwords (plaintext or hashed)
- Session tokens or authentication tokens
- Credit card numbers or payment information
- Social Security Numbers or other PII
- CSRF tokens
- API keys or secrets

### Log Message Formatting

**Use Clear, Descriptive Messages**:

```javascript
// CORRECT - Clear and specific
logger.error('Failed to assign ticket - user not found', { ticketId, userId });

// INCORRECT - Vague
logger.error('Error in ticket operation');
```

**Use Consistent Tense and Voice**:

```javascript
// CORRECT - Past tense for completed actions
logger.info('User created', { userId: newUser.id });
logger.error('Database connection failed', { error: err.message });

// CORRECT - Present tense for current state
logger.warn('Rate limit exceeded', { ip: req.ip });
```

**Keep Messages Concise**:

```javascript
// CORRECT - Brief message, details in metadata
logger.error('Password reset failed', {
  userId: user.id,
  reason: 'Invalid current password'
});

// INCORRECT - Long message with embedded details
logger.error('Password reset failed for user 123 because the current password provided was invalid');
```

### Avoiding Sensitive Data in Logs

```javascript
// CORRECT - Logging authentication attempt without password
logger.warn('Failed login attempt', {
  username: username,
  ip: req.ip,
  attempts: loginAttempts + 1
});

// INCORRECT - Logging password (SECURITY VIOLATION)
logger.warn('Failed login', {
  username: username,
  password: password  // NEVER DO THIS!
});

// CORRECT - Logging user creation without password
logger.info('User created', {
  userId: newUser.id,
  username: newUser.username,
  email: newUser.email,
  role: newUser.role
});

// INCORRECT - Logging password hash
logger.info('User created', {
  userId: newUser.id,
  password_hash: newUser.password_hash  // Avoid logging hashes
});

// CORRECT - Logging session activity without session data
logger.info('Session regenerated', {
  userId: req.session.user.id,
  ip: req.ip
});

// INCORRECT - Logging full session object
logger.info('Session data', {
  session: req.session  // May contain sensitive data
});
```

### Log File Management

**Rotation Policy**:
- Winston handles rotation automatically
- Max file size: 5MB
- Max files: 5 (per log type)
- Total disk usage: ~50MB (error.log + combined.log with rotation)

**Manual Log Management**:

```bash
# View recent logs (last 100 lines)
tail -100 logs/combined.log

# Follow logs in real-time
tail -f logs/combined.log

# Search logs for specific error
grep "Failed to create ticket" logs/combined.log

# View errors from specific date
grep "2025-12-30" logs/error.log

# Clear old logs (be careful!)
> logs/combined.log  # Truncate file (DO NOT use in production!)
```

**Production Log Management**:
- Use log aggregation tools (e.g., ELK stack, Splunk, Datadog)
- Set up log rotation with `logrotate` on Linux
- Archive old logs to long-term storage
- Monitor log volume for anomalies

---

## Error Handling & Debugging Flow

### Three-Layer Error Architecture

The KNII Ticketing System uses a three-layer error handling architecture:

```
1. Route Layer (routes/*.js)
   ├─ Wraps logic in try-catch
   ├─ Calls services and models
   └─ On error: next(error) → passes to global handler

2. Service Layer (services/*.js)
   ├─ Contains business logic
   ├─ Throws descriptive Error objects
   └─ Error messages describe business rule violations

3. Global Error Handler (middleware/errorHandler.js)
   ├─ Catches all errors from next(error)
   ├─ Logs with full context
   ├─ Returns user-friendly error responses
   └─ Environment-aware (dev: detailed, prod: generic)
```

### Error Flow Example: Updating a User

**Route Layer** (`routes/users.js`):

```javascript
router.put('/:id', async (req, res, next) => {
  try {
    const targetId = req.userId;  // Parsed by parseUserId middleware
    const { username, email, status } = req.body;

    await userService.updateUser(
      req.session.user.id,  // actorId
      targetId,
      { username, email, status },
      req.ip
    );

    successRedirect(req, res, USER_MESSAGES.UPDATED, '/admin/users');
  } catch (error) {
    logger.error('Failed to update user', {
      error: error.message,
      stack: error.stack,
      targetId: req.userId,
      actor: req.session.user.id
    });
    next(error);  // Pass to global error handler
  }
});
```

**Service Layer** (`services/userService.js`):

```javascript
async updateUser(actorId, targetId, updates, ipAddress) {
  // Business rule validation
  const targetUser = await User.findById(targetId);
  if (!targetUser) {
    throw new Error('User not found');  // Descriptive error
  }

  if (targetUser.role === 'super_admin' && actorId !== targetId) {
    throw new Error('Cannot modify super admin users');  // Business rule
  }

  // Check for email conflicts
  if (updates.email) {
    const existingUser = await User.findByEmail(updates.email);
    if (existingUser && existingUser.id !== targetId) {
      throw new Error('Email already in use');
    }
  }

  // Perform update
  const result = await pool.query(
    'UPDATE users SET username = $1, email = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
    [updates.username, updates.email, updates.status, targetId]
  );

  // Clear sessions if user was deactivated
  if (updates.status && updates.status !== 'active') {
    await User.clearUserSessions(targetId);
  }

  // Audit log
  await AuditLog.create({
    actorId,
    action: 'USER_UPDATED',
    targetType: 'user',
    targetId,
    details: updates,
    ipAddress
  });

  return result.rows[0];
}
```

**Global Error Handler** (`middleware/errorHandler.js`):

```javascript
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Error caught by global handler', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    status: err.status || 500
  });

  // Determine status code
  const statusCode = err.status || 500;

  // Environment-aware message
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  // JSON response for API requests
  if (req.xhr || req.headers.accept.includes('json')) {
    return res.status(statusCode).json({ error: message });
  }

  // HTML response for browser requests
  req.flash('error_msg', message);
  res.redirect('back');  // or res.render('errors/500', { message });
}
```

### Debugging Error Flow

When an error occurs, trace it through all three layers:

**Step 1: Check Global Error Handler Logs**

```bash
# Development (Docker)
docker-compose logs web | grep "Error caught by global handler"

# Production (PM2)
pm2 logs ticketing-system | grep "Error caught by global handler"

# Or check error.log file
grep "Error caught by global handler" logs/error.log
```

**Step 2: Identify the Route**

Look at the `url` and `method` in the log:

```json
{
  "error": "User not found",
  "stack": "Error: User not found\n    at UserService.updateUser (/app/services/userService.js:42:11)",
  "method": "PUT",
  "url": "/admin/users/123"
}
```

This indicates the error occurred in `PUT /admin/users/123` (update user route).

**Step 3: Check Route Layer Logs**

Find the route-specific log entry:

```bash
grep "Failed to update user" logs/combined.log
```

```json
{
  "message": "Failed to update user",
  "error": "User not found",
  "targetId": 123,
  "actor": 1
}
```

This tells us:
- Actor (user ID 1) tried to update user ID 123
- Error: "User not found"

**Step 4: Trace to Service Layer**

Look at the stack trace to find where the error was thrown:

```
Error: User not found
    at UserService.updateUser (/app/services/userService.js:42:11)
```

Open `services/userService.js:42` to see:

```javascript
const targetUser = await User.findById(targetId);
if (!targetUser) {
  throw new Error('User not found');  // <-- Error thrown here
}
```

**Step 5: Verify at Model Layer**

Check if the database query succeeded:

```sql
-- Connect to database
docker-compose exec db psql -U ticketing_user -d ticketing_db

-- Check if user exists
SELECT * FROM users WHERE id = 123;
```

If the user doesn't exist, the error is expected. If the user exists, the issue is in `User.findById()`.

**Step 6: Fix the Issue**

Based on the trace:
- If user doesn't exist: Expected error, improve error message to user
- If user exists but not found: Bug in `User.findById()` (check query logic)
- If database error: Check connection, permissions, or query syntax

### Cross-Reference: Error Handling Patterns

For comprehensive error handling patterns, see:
- [docs/node_js.md - Error Handling Section](node_js.md#error-handling-knii-implementation)

---

## Development Debugging Workflows

### Docker Debugging Commands

#### Viewing Logs

```bash
# Watch application logs in real-time
docker-compose logs -f web

# View last 100 log lines
docker-compose logs --tail=100 web

# View logs from specific time
docker-compose logs --since 30m web  # Last 30 minutes

# View both web and database logs
docker-compose logs -f web db

# Filter logs by keyword
docker-compose logs web | grep "Error"
docker-compose logs web | grep "userId: 5"
```

#### Accessing Containers

```bash
# Access web container shell
docker-compose exec web sh

# Inside container:
ls -la                          # List files
cat logs/error.log              # View error log
env | grep DATABASE             # Check environment variables
node scripts/seed-admin.js      # Run scripts manually

# Access database container
docker-compose exec db psql -U ticketing_user -d ticketing_db

# Inside PostgreSQL:
\dt                             # List tables
SELECT * FROM users;            # Query users
\d users                        # Describe users table
\q                              # Exit
```

#### Restarting Services

```bash
# Restart just the web application (preserves database)
docker-compose restart web

# Rebuild and restart (after code changes)
docker-compose up -d --build web

# Stop and remove all containers (preserves volumes)
docker-compose down

# Stop and remove everything including data (DESTRUCTIVE)
docker-compose down -v

# Start services in foreground (see logs directly)
docker-compose up web db
```

#### Debugging Build Issues

```bash
# Rebuild from scratch (no cache)
docker-compose build --no-cache web

# Check container status
docker-compose ps

# Inspect container details
docker inspect knii_ticketing_web

# View container resource usage
docker stats knii_ticketing_web
```

### Nodemon Auto-Restart Debugging

**Configuration**: `package.json`

```json
{
  "scripts": {
    "dev": "nodemon index.js"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

**Usage**:

```bash
# In Docker (if configured)
docker-compose exec web npm run dev

# Without Docker
npm run dev
```

**Nodemon watches for file changes and auto-restarts the server.**

**Debugging Nodemon Issues**:

```bash
# Check which files nodemon is watching
nodemon --watch . --ext js --exec node index.js

# Ignore specific files/folders
nodemon --ignore tests/ --ignore logs/ index.js

# Verbose output
nodemon -V index.js
```

### Database Query Debugging

#### Accessing PostgreSQL

```bash
# Via Docker
docker-compose exec db psql -U ticketing_user -d ticketing_db

# Direct connection (if exposed)
psql -h localhost -p 5432 -U ticketing_user -d ticketing_db
```

#### Common Debugging Queries

**Check User Accounts**:

```sql
-- List all users
SELECT id, username, email, role, status, login_attempts, last_login_at
FROM users
ORDER BY created_at DESC;

-- Find specific user
SELECT * FROM users WHERE username = 'admin';

-- Check for locked accounts
SELECT id, username, login_attempts, last_login_at
FROM users
WHERE login_attempts >= 5;

-- Reset login attempts
UPDATE users SET login_attempts = 0 WHERE username = 'admin';
```

**Check Active Sessions**:

```sql
-- Count active sessions
SELECT COUNT(*) FROM session WHERE expire > NOW();

-- List active sessions with user info
SELECT s.sid, s.sess->>'user' as user_data, s.expire
FROM session s
WHERE expire > NOW()
ORDER BY expire DESC;

-- Clear all sessions (force logout all users)
TRUNCATE session;  -- CAUTION: Logs out all users!

-- Clear sessions for specific user
DELETE FROM session
WHERE sess::text LIKE '%"id":123%';  -- Replace 123 with user ID
```

**Check Tickets**:

```sql
-- Recent tickets
SELECT id, title, status, priority, reporter_email, assigned_to, created_at
FROM tickets
ORDER BY created_at DESC
LIMIT 10;

-- Tickets by status
SELECT status, COUNT(*) as count
FROM tickets
GROUP BY status;

-- Unassigned tickets
SELECT id, title, priority, created_at
FROM tickets
WHERE assigned_to IS NULL
ORDER BY priority DESC, created_at ASC;
```

**Check Audit Logs**:

```sql
-- Recent audit events
SELECT id, actor_id, action, target_type, target_id, details, ip_address, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- Actions by specific user
SELECT action, target_type, target_id, created_at
FROM audit_logs
WHERE actor_id = 1  -- Replace with user ID
ORDER BY created_at DESC;

-- Failed login attempts
SELECT details->>'username' as username, ip_address, created_at
FROM audit_logs
WHERE action = 'USER_LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 10;
```

#### Query Performance Debugging

```sql
-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM tickets WHERE status = 'open' AND assigned_to IS NULL;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find slow queries (if pg_stat_statements enabled)
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Node.js --inspect Debugging

**Enable Inspector**:

```bash
# Start with debugger
node --inspect index.js

# Start with debugger and break on first line
node --inspect-brk index.js

# Custom inspector port
node --inspect=0.0.0.0:9229 index.js
```

**With Docker**:

Update `docker-compose.yml`:

```yaml
services:
  web:
    command: node --inspect=0.0.0.0:9229 index.js
    ports:
      - "3000:3000"
      - "9229:9229"  # Debugger port
```

**Chrome DevTools**:

1. Open Chrome and navigate to `chrome://inspect`
2. Click "Configure" and add `localhost:9229`
3. Click "inspect" under your Node.js process
4. Set breakpoints, inspect variables, step through code

**VS Code Debugging**:

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Docker",
      "address": "localhost",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "protocol": "inspector"
    }
  ]
}
```

### Reading Morgan HTTP Logs

**Format**: Combined format

```
<IP> - - [<Date>] "<Method> <URL> <HTTP Version>" <Status> <Size> "<Referrer>" "<User-Agent>"
```

**Example**:

```
::1 - - [30/Dec/2025:10:15:32 +0000] "GET /admin/dashboard HTTP/1.1" 200 5432 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Interpretation**:
- `::1` - IPv6 localhost
- `[30/Dec/2025:10:15:32 +0000]` - Timestamp
- `"GET /admin/dashboard HTTP/1.1"` - Request method, URL, HTTP version
- `200` - Status code (success)
- `5432` - Response size in bytes
- `"-"` - No referrer
- `"Mozilla/5.0 ..."` - User agent (browser)

**Filtering Morgan Logs**:

```bash
# All errors (4xx and 5xx)
docker-compose logs web | grep '" [45][0-9][0-9] '

# Specific endpoint
docker-compose logs web | grep "GET /admin/users"

# Slow requests (manual timing analysis)
docker-compose logs web | grep "POST /auth/login"

# By IP address
docker-compose logs web | grep "192.168.1.100"
```

### Session Debugging Techniques

**Check Session Cookie**:

Browser DevTools → Application/Storage → Cookies → `connect.sid`

**Verify Session in Database**:

```sql
-- Find session by cookie value
SELECT * FROM session WHERE sid = 'YOUR_SESSION_ID_HERE';

-- Decode session data
SELECT sid, sess->'cookie' as cookie, sess->'user' as user_data
FROM session
WHERE sid = 'YOUR_SESSION_ID_HERE';
```

**Debug Session Not Persisting**:

1. Check `SESSION_SECRET` is set
2. Verify PostgreSQL session table exists: `\dt session`
3. Check session middleware is configured before routes
4. Verify `req.session.save()` is called if manually modifying session

**Debug "Session not found" Errors**:

1. Check session expiration: `SELECT expire FROM session WHERE sid = '...'`
2. Verify cookie settings (httpOnly, secure, sameSite)
3. Check if user was logged out (session cleared)
4. Verify browser is sending cookies (check request headers)

### Console Debugging Patterns

**When Console Debugging is Appropriate**:

- One-time setup scripts (`scripts/init-db.js`, `scripts/seed-admin.js`)
- Quick local debugging (remove before commit)
- CI/CD pipeline output

**When to Use Logger Instead**:

- Application code (routes, services, models, middleware)
- Production environments
- Persistent logging requirements

```javascript
// ACCEPTABLE - In one-time scripts
console.log('Running database initialization...');
console.error('Migration failed:', error.message);

// INCORRECT - In application code
app.get('/admin/dashboard', async (req, res) => {
  console.log('Dashboard accessed');  // Use logger.info() instead
  // ...
});

// CORRECT - In application code
app.get('/admin/dashboard', async (req, res) => {
  logger.info('Dashboard accessed', { userId: req.session.user.id });
  // ...
});
```

---

## Production Debugging

### PM2 Logs and Monitoring

**Accessing Logs**:

```bash
# View logs (combined stdout and stderr)
pm2 logs ticketing-system

# View last 100 lines
pm2 logs ticketing-system --lines 100

# Watch logs in real-time
pm2 logs ticketing-system --raw

# View only errors (stderr)
pm2 logs ticketing-system --err

# View only standard output
pm2 logs ticketing-system --out
```

**Log File Locations**:

- Stdout: `~/.pm2/logs/ticketing-system-out.log`
- Stderr: `~/.pm2/logs/ticketing-system-error.log`
- PM2 logs: `~/.pm2/pm2.log`

**Real-Time Monitoring**:

```bash
# Interactive dashboard
pm2 monit

# Process status
pm2 status

# Detailed process info
pm2 show ticketing-system

# CPU and memory usage
pm2 list
```

**PM2 Restart Strategies**:

```bash
# Graceful reload (zero downtime)
pm2 reload ticketing-system

# Hard restart (kills and restarts)
pm2 restart ticketing-system

# Stop application
pm2 stop ticketing-system

# Start application
pm2 start ticketing-system

# Restart on file change (development)
pm2 start ecosystem.config.js --watch
```

**PM2 Cluster Mode Debugging**:

```bash
# List all cluster instances
pm2 list

# Example output:
# ticketing-system-0  │ online    │
# ticketing-system-1  │ online    │
# ticketing-system-2  │ online    │
# ticketing-system-3  │ online    │

# Restart specific instance
pm2 restart ticketing-system-0

# Scale cluster
pm2 scale ticketing-system 2  # Reduce to 2 instances
pm2 scale ticketing-system 8  # Increase to 8 instances
```

### Log File Access in Production

**Winston Log Files**:

```bash
# Navigate to application directory
cd /path/to/knii_ticketing

# View recent errors
tail -f logs/error.log

# View all logs
tail -f logs/combined.log

# Search for specific error
grep "Failed to create ticket" logs/error.log

# View logs from specific time range
grep "2025-12-30 10:" logs/combined.log

# Count errors by type
grep "Error" logs/error.log | sort | uniq -c | sort -rn
```

**Rotation and Cleanup**:

Winston handles rotation automatically (5MB max, 5 files). Manual cleanup:

```bash
# Archive old logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Clear logs (CAUTION: Only after archiving)
> logs/error.log
> logs/combined.log

# Or just delete old rotated files
rm logs/error.log.1 logs/error.log.2 logs/combined.log.1 logs/combined.log.2
```

### Performance Monitoring

**PM2 Metrics**:

```bash
# CPU and memory usage
pm2 status

# Real-time monitoring
pm2 monit

# Event log (restarts, errors)
pm2 logs pm2
```

**Custom Health Check**:

Add a health endpoint (`index.js`):

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});
```

Monitor with:

```bash
# Check health
curl http://localhost:3000/health

# Monitor continuously
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

### Production Error Tracking

**Error Notification Setup** (future enhancement):

Consider integrating error tracking services:
- Sentry (error tracking and performance monitoring)
- Rollbar (real-time error tracking)
- Bugsnag (error monitoring and reporting)
- New Relic (APM and error tracking)

**Current Manual Process**:

1. Monitor PM2 logs: `pm2 logs ticketing-system --err`
2. Check Winston error.log: `tail -f logs/error.log`
3. Review audit logs for user actions leading to errors
4. Check database for data inconsistencies

### Zero-Downtime Debugging

**PM2 Reload** (zero downtime):

```bash
# Graceful reload (recommended for production)
pm2 reload ticketing-system

# Process:
# 1. PM2 starts new instance(s)
# 2. New instances listen on same port
# 3. Old instances finish current requests
# 4. Old instances shut down
# 5. All traffic now on new instances
```

**Database Debugging (Read-Only)**:

```bash
# Connect with read-only user (if configured)
psql -h localhost -U ticketing_readonly -d ticketing_db

# Or use SELECT queries only with regular user
psql -h localhost -U ticketing_user -d ticketing_db

# Inside PostgreSQL:
SELECT * FROM users WHERE id = 123;  -- Safe (read-only)
DELETE FROM users WHERE id = 123;    -- NEVER run in production!
```

**Non-Disruptive Debugging**:

1. Check logs first (no impact)
2. Query database with read-only queries
3. Test in staging environment with production data snapshot
4. Use feature flags to enable/disable features without redeployment

### Production Incident Response

**Step-by-Step Response**:

1. **Assess Severity**
   - Is the application down? (Check health endpoint)
   - Are users impacted? (Check error rate in logs)
   - Is data at risk? (Check for database errors)

2. **Gather Information**
   ```bash
   pm2 status                        # Check process status
   pm2 logs --lines 200              # Recent logs
   tail -100 logs/error.log          # Recent errors
   ```

3. **Check Recent Changes**
   ```bash
   git log -5                        # Recent commits
   pm2 logs pm2                      # Recent restarts
   ```

4. **Check Database Health**
   ```sql
   SELECT COUNT(*) FROM pg_stat_activity;  -- Active connections
   SELECT * FROM pg_stat_activity WHERE state = 'active';  -- Running queries
   ```

5. **Mitigate**
   - If application is down: `pm2 restart ticketing-system`
   - If database issues: Check connection pool, restart if necessary
   - If specific endpoint failing: Add rate limiting or disable feature

6. **Document and Communicate**
   - Document the incident (what happened, when, impact)
   - Notify stakeholders
   - Create post-mortem for future prevention

---

## Security-Related Debugging

### Rate Limiting Debugging

**Configuration**: `middleware/rateLimiter.js`

**Login Limiter**:
- Limit: 10 attempts per 15 minutes per IP
- Endpoint: `/auth/login`
- On limit exceeded: Redirects to login with flash message

**Ticket Submission Limiter**:
- Limit: 5 submissions per hour per IP
- Endpoint: `/submit-ticket`
- On limit exceeded: Redirects to form with flash message

**Debugging Rate Limit Issues**:

1. **Check if Rate Limit is Active**

```bash
# Look for rate limit messages in logs
docker-compose logs web | grep "rate limit"

# Or check flash messages in browser
```

2. **Identify the IP Being Limited**

Rate limiting is per-IP. Check the request IP:

```javascript
// In route or middleware
logger.info('Request IP', { ip: req.ip, forwarded: req.headers['x-forwarded-for'] });
```

3. **Bypass Rate Limit for Testing** (development only)

Temporarily comment out rate limiter middleware:

```javascript
// In routes/auth.js or routes/public.js
// router.post('/login', loginLimiter, validateLogin, validateRequest, ...);
router.post('/login', validateLogin, validateRequest, ...);  // Limiter disabled
```

Remember to re-enable before committing!

4. **Check Rate Limit Store**

Rate limiters use in-memory store by default. Check if application restarted (clears limits):

```bash
pm2 logs pm2 | grep restart
```

5. **Adjust Rate Limits** (if necessary)

Edit `middleware/rateLimiter.js`:

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // Change window
  max: 10,                   // Change max attempts
  message: 'Too many login attempts, please try again later.'
});
```

### CSRF Token Debugging

**Common CSRF Issues**:

1. **"Invalid CSRF Token" Error**

**Symptoms**: Form submission fails with "Invalid CSRF token" message

**Causes**:
- Token not included in form
- Token expired (session expired)
- Token mismatch (form loaded from different session)
- Double-submit cookie not sent

**Debugging**:

```javascript
// Check if token is present in form
// View page source and look for:
<input type="hidden" name="_csrf" value="SOME_TOKEN_VALUE">

// Check if cookie is set
// Browser DevTools → Application → Cookies → __Host-psifi.x-csrf-token

// Verify token in request
logger.debug('CSRF token check', {
  bodyToken: req.body._csrf,
  cookie: req.cookies['__Host-psifi.x-csrf-token']
});
```

**Solution**:
- Ensure `<%= csrfToken %>` is in all forms
- Check session is valid (not expired)
- Verify CSRF middleware is before routes

2. **Missing CSRF Token in Form**

**Symptoms**: No hidden `_csrf` field in form

**Cause**: Template missing `csrfToken` variable

**Solution**: Add to all POST/PUT/DELETE forms:

```html
<form method="POST" action="/some/endpoint">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <!-- other fields -->
</form>
```

3. **CSRF Cookie Not Set**

**Symptoms**: `__Host-psifi.x-csrf-token` cookie missing

**Cause**: CSRF middleware not configured

**Solution**: Verify in `index.js`:

```javascript
const { doubleCsrfProtection } = require('./config/csrf');
app.use(doubleCsrfProtection);
```

4. **Testing CSRF Protection**

```bash
# Attempt request without token (should fail)
curl -X POST http://localhost:3000/auth/login \
  -d "username=admin&password=test" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Expected: 403 Forbidden or "Invalid CSRF token"

# Valid request (with token - get from browser DevTools)
curl -X POST http://localhost:3000/auth/login \
  -d "username=admin&password=test&_csrf=TOKEN_VALUE" \
  -H "Cookie: __Host-psifi.x-csrf-token=COOKIE_VALUE" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### Session Debugging

**Check Session Configuration**:

```javascript
// config/session.js
module.exports = {
  secret: process.env.SESSION_SECRET,  // Must be set!
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,        // Prevents XSS
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    sameSite: 'strict',    // CSRF protection
    maxAge: 1000 * 60 * 60 * 24  // 24 hours
  },
  store: pgStore  // PostgreSQL session store
};
```

**Common Session Issues**:

1. **Session Not Persisting**

**Symptoms**: User logged out after refresh

**Debugging**:
```sql
-- Check if session table exists
\dt session

-- Check if sessions are being created
SELECT COUNT(*) FROM session;

-- View session data
SELECT * FROM session WHERE expire > NOW() LIMIT 5;
```

**Causes**:
- `SESSION_SECRET` not set
- Session table not created (run migrations)
- Cookie not being sent (check browser settings, HTTPS in production)

2. **Session Invalidation Issues**

**Symptoms**: User still logged in after account deactivation

**Debugging**:
```sql
-- Check user status
SELECT id, username, status FROM users WHERE id = 123;

-- Check for active sessions
SELECT * FROM session WHERE sess::text LIKE '%"id":123%';
```

**Solution**: Ensure `User.clearUserSessions()` is called when deactivating users:

```javascript
// In userService.js
if (status && status !== 'active' && status !== targetUser.status) {
  await User.clearUserSessions(targetId);
}
```

3. **Session Destruction Errors**

**Symptoms**: Error when logging out

**Debugging**:

```javascript
// In auth.js
req.session.destroy((err) => {
  if (err) {
    logger.error('Failed to destroy session', {
      error: err.message,
      sessionId: req.sessionID
    });
    return next(err);
  }
  res.redirect('/auth/login');
});
```

### Authentication Failures

**Login Debugging Workflow**:

1. **Check Credentials**

```sql
-- Verify user exists
SELECT id, username, email, role, status, login_attempts
FROM users
WHERE username = 'admin';
```

2. **Check Account Status**

```sql
-- Check if locked
SELECT username, login_attempts, status
FROM users
WHERE username = 'admin';

-- Reset if locked
UPDATE users SET login_attempts = 0 WHERE username = 'admin';

-- Activate if inactive
UPDATE users SET status = 'active' WHERE username = 'admin';
```

3. **Check Authentication Service**

```javascript
// services/authService.js
async authenticate(username, password) {
  // Find user with password hash
  const user = await User.findByUsernameWithPassword(username);

  if (!user) {
    // Timing attack prevention: dummy hash comparison
    await bcrypt.compare(password, '$2a$10$dummy...');
    throw new Error('Invalid credentials');
  }

  // Check account status
  if (user.status !== 'active') {
    throw new Error('Account is inactive');
  }

  // Check if locked
  if (user.login_attempts >= 5) {
    throw new Error('Account is locked due to too many failed attempts');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    // Increment login attempts
    await User.incrementLoginAttempts(user.id);
    throw new Error('Invalid credentials');
  }

  // Reset login attempts on success
  await User.resetLoginAttempts(user.id);

  return user;
}
```

4. **Common Authentication Errors**

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Invalid credentials" | Wrong username or password | Verify credentials |
| "Account is inactive" | User status is not 'active' | Check `status` field |
| "Account is locked" | Too many failed login attempts (>=5) | Reset `login_attempts` |
| "User not found" | User doesn't exist | Create user or fix username |

5. **Password Reset Debugging**

```sql
-- Verify user exists
SELECT id, username, email, password_changed_at
FROM users
WHERE id = 123;

-- Check when password was last changed
SELECT username, password_changed_at
FROM users
WHERE id = 123;
```

### Audit Log Analysis

**Viewing Security Events**:

```sql
-- Recent failed logins
SELECT
  created_at,
  ip_address,
  details->>'username' as username,
  details->>'reason' as reason
FROM audit_logs
WHERE action = 'USER_LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 20;

-- Successful logins
SELECT
  created_at,
  actor_id,
  ip_address
FROM audit_logs
WHERE action = 'USER_LOGIN'
ORDER BY created_at DESC
LIMIT 20;

-- User modifications (who changed what)
SELECT
  created_at,
  actor_id,
  target_id,
  details
FROM audit_logs
WHERE action = 'USER_UPDATED'
ORDER BY created_at DESC;

-- Password resets
SELECT
  created_at,
  actor_id,
  target_id,
  ip_address
FROM audit_logs
WHERE action = 'PASSWORD_RESET'
ORDER BY created_at DESC;

-- Suspicious activity (multiple IPs for same user)
SELECT
  actor_id,
  COUNT(DISTINCT ip_address) as ip_count,
  array_agg(DISTINCT ip_address) as ips
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY actor_id
HAVING COUNT(DISTINCT ip_address) > 3;
```

**Audit Log Actions**:

- `USER_LOGIN` - Successful login
- `USER_LOGIN_FAILED` - Failed login attempt
- `USER_CREATED` - New user created
- `USER_UPDATED` - User modified
- `USER_DELETED` - User soft-deleted
- `PASSWORD_RESET` - Password changed
- `TICKET_CREATED` - New ticket created
- `TICKET_UPDATED` - Ticket modified
- `COMMENT_CREATED` - Comment added
- `COMMENT_DELETED` - Comment removed

---

## Common Issues & Solutions

### Database Connection Errors

#### Issue: "Connection refused" (ECONNREFUSED)

**Symptoms**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Root Cause**: Application cannot reach PostgreSQL server

**Debugging Steps**:

1. Check if PostgreSQL is running:
```bash
# Docker
docker-compose ps db

# Direct PostgreSQL
systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS
```

2. Verify connection string:
```bash
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
```

3. Test connection manually:
```bash
psql -h localhost -p 5432 -U ticketing_user -d ticketing_db
```

**Solutions**:

- Start PostgreSQL: `docker-compose up -d db`
- Check `DATABASE_URL` in `.env` file
- Verify host is correct (`db` for Docker, `localhost` for local)
- Check port is correct (default: 5432)
- Verify firewall allows connections on port 5432

**Prevention**:
- Use health checks in docker-compose.yml
- Add connection retry logic in application
- Monitor database availability

#### Issue: "Connection pool exhausted"

**Symptoms**:
```
Error: Timeout acquiring connection from pool
```

**Root Cause**: Too many database connections open, pool limit reached

**Debugging Steps**:

1. Check active connections:
```sql
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'ticketing_db';
```

2. Check pool configuration:
```javascript
// config/database.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20  // Maximum connections
});
```

3. Find long-running queries:
```sql
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE state = 'active' AND query_start < NOW() - INTERVAL '1 minute';
```

**Solutions**:

- Increase pool size: `max: 30` (if server can handle it)
- Kill stuck queries: `SELECT pg_terminate_backend(PID);`
- Ensure all queries use `pool.query()` (not `pool.connect()` without release)
- Check for connection leaks (missing `client.release()`)

**Prevention**:
- Always use `pool.query()` for one-off queries
- If using `pool.connect()`, always call `client.release()` in finally block
- Monitor connection pool metrics

#### Issue: "Password authentication failed"

**Symptoms**:
```
Error: password authentication failed for user "ticketing_user"
```

**Root Cause**: Incorrect database credentials

**Debugging Steps**:

1. Check environment variables:
```bash
echo $DATABASE_URL
echo $POSTGRES_USER
echo $POSTGRES_PASSWORD
```

2. Verify PostgreSQL user exists:
```sql
-- As superuser
\du  -- List database users
```

3. Test credentials:
```bash
psql -U ticketing_user -d ticketing_db
# Enter password when prompted
```

**Solutions**:

- Update `DATABASE_URL` in `.env` file
- Recreate PostgreSQL user with correct password
- Update `POSTGRES_PASSWORD` in docker-compose.yml
- Restart database after password change

**Prevention**:
- Use strong, unique passwords
- Store credentials in .env file (not in code)
- Document password requirements

#### Issue: "Query timeout"

**Symptoms**:
```
Error: Query read timeout
```

**Root Cause**: Query taking too long to execute

**Debugging Steps**:

1. Identify slow query:
```sql
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE state = 'active' AND query_start < NOW() - INTERVAL '10 seconds';
```

2. Explain query plan:
```sql
EXPLAIN ANALYZE <your query here>;
```

3. Check for missing indexes:
```sql
-- Check if query is doing full table scans
EXPLAIN ANALYZE
SELECT * FROM tickets WHERE status = 'open';
```

**Solutions**:

- Add indexes for frequently queried columns
- Optimize query (limit results, use WHERE clauses)
- Increase query timeout (if necessary)
- Paginate large result sets

**Prevention**:
- Add indexes during migrations
- Test queries with production-like data volumes
- Use query performance monitoring

### Migration Problems

#### Issue: "Migration already applied"

**Symptoms**: Migration script reports file already run

**Root Cause**: Attempting to re-run a migration

**Debugging Steps**:

1. Check which migrations have been run:
```bash
# If using migration tracking table
SELECT * FROM schema_migrations ORDER BY id;
```

2. Check if migration file was modified:
```bash
git log migrations/004_example.sql
```

**Solutions**:

- If migration was already applied: No action needed
- If migration was modified after running: Create new migration file
- If migration failed midway: Manually rollback and re-run

**Prevention**:
- Never modify migration files after running them
- Use sequential numbering (001, 002, 003...)
- Create new migration files for changes

#### Issue: "Migration failed midway"

**Symptoms**: Migration error partway through execution

**Root Cause**: Syntax error, constraint violation, or missing dependencies

**Debugging Steps**:

1. Check PostgreSQL logs:
```bash
docker-compose logs db | grep ERROR
```

2. Manually test migration:
```bash
docker-compose exec db psql -U ticketing_user -d ticketing_db < migrations/004_example.sql
```

3. Check for partial changes:
```sql
\dt  -- List tables to see if any were created
```

**Solutions**:

- If migration created tables/columns: Manually rollback (DROP TABLE, DROP COLUMN)
- Fix syntax error in migration file
- Run migration again

**Prevention**:
- Test migrations on development database first
- Use transactions (BEGIN; ... COMMIT;) in migrations
- Review migration files before running

#### Issue: "Schema conflicts"

**Symptoms**: Migration fails due to existing table or column

**Root Cause**: Database schema doesn't match expected state

**Debugging Steps**:

1. Check table structure:
```sql
\d users  -- Describe users table
```

2. Check for conflicting objects:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'users';
SELECT * FROM information_schema.columns WHERE table_name = 'users';
```

**Solutions**:

- If table exists with different structure: Drop and recreate (CAUTION: data loss!)
- If column exists: Skip column creation or alter instead
- If migration order is wrong: Rename files to correct sequence

**Prevention**:
- Keep development database in sync with migrations
- Document database schema expectations
- Use migration rollback scripts

### Session Store Issues

#### Issue: "Sessions not persisting"

**Symptoms**: User logged out after page refresh

**Root Cause**: Session not being saved to database

**Debugging Steps**:

1. Check if session table exists:
```sql
\dt session
```

2. Check if sessions are being created:
```sql
SELECT COUNT(*) FROM session;
SELECT * FROM session WHERE expire > NOW() LIMIT 5;
```

3. Verify session configuration:
```bash
echo $SESSION_SECRET
# Should be at least 32 characters
```

4. Check session middleware:
```javascript
// index.js
app.use(session(sessionConfig));  // Must be before routes
```

**Solutions**:

- Create session table: Run `node scripts/init-db.js`
- Set `SESSION_SECRET` in `.env` file
- Verify session middleware is configured before routes
- Check PostgreSQL is running

**Prevention**:
- Include session table in migrations
- Document `SESSION_SECRET` requirement in README
- Add health check for session store

#### Issue: "Session table missing"

**Symptoms**: Error on login: "relation 'session' does not exist"

**Root Cause**: Session table not created

**Debugging Steps**:

1. Check if table exists:
```sql
\dt session
```

2. Check if migrations ran:
```bash
docker-compose exec web node scripts/init-db.js
```

**Solutions**:

- Run migrations: `node scripts/init-db.js`
- Or create table manually (see connect-pg-simple schema)

**Prevention**:
- Include session table creation in first migration
- Document setup steps in README
- Add seed script that checks for required tables

#### Issue: "Expired sessions not cleared"

**Symptoms**: Session table growing indefinitely

**Root Cause**: Expired sessions not being pruned

**Debugging Steps**:

1. Check number of expired sessions:
```sql
SELECT COUNT(*) FROM session WHERE expire < NOW();
```

2. Check total sessions:
```sql
SELECT COUNT(*) FROM session;
```

**Solutions**:

- Manual cleanup:
```sql
DELETE FROM session WHERE expire < NOW();
```

- Automated cleanup (add to cron):
```bash
# Run daily at 2 AM
0 2 * * * psql -U ticketing_user -d ticketing_db -c "DELETE FROM session WHERE expire < NOW();"
```

**Prevention**:
- Use connect-pg-simple's built-in cleanup (check documentation)
- Set up automated cleanup job
- Monitor session table size

### Port Conflicts

#### Issue: "Port 3000 already in use" (EADDRINUSE)

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Root Cause**: Another process is using port 3000

**Debugging Steps**:

1. Find process using port:
```bash
# Linux/macOS
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

2. Check if old application instance is running:
```bash
# Docker
docker-compose ps

# PM2
pm2 list
```

**Solutions**:

- Kill process using port:
```bash
# Linux/macOS
kill -9 PID  # Replace PID with process ID from lsof

# Windows
taskkill /PID PID /F
```

- Stop Docker containers:
```bash
docker-compose down
```

- Use different port:
```bash
PORT=3001 npm start
```

**Prevention**:
- Properly stop application before restarting
- Use unique ports for different environments
- Add port check in startup script

### Environment Variable Issues

#### Issue: "SESSION_SECRET not set"

**Symptoms**: Application won't start or session errors

**Root Cause**: Missing `SESSION_SECRET` environment variable

**Debugging Steps**:

1. Check if variable is set:
```bash
echo $SESSION_SECRET
```

2. Check .env file:
```bash
cat .env | grep SESSION_SECRET
```

**Solutions**:

- Add to .env file:
```bash
SESSION_SECRET=your_very_long_and_secure_random_string_here_at_least_32_characters
```

- Generate secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Prevention**:
- Document required environment variables in README
- Provide .env.example file
- Validate environment on startup

#### Issue: "DATABASE_URL malformed"

**Symptoms**: Database connection error

**Root Cause**: Incorrect `DATABASE_URL` format

**Debugging Steps**:

1. Check current value:
```bash
echo $DATABASE_URL
```

2. Verify format:
```
postgresql://username:password@host:port/database
```

**Solutions**:

- Fix format in .env file:
```bash
DATABASE_URL=postgresql://ticketing_user:password@db:5432/ticketing_db
```

- For Docker: host should be service name (`db`)
- For local: host should be `localhost`

**Prevention**:
- Provide DATABASE_URL example in .env.example
- Document format in README
- Validate format on startup

#### Issue: "LOG_LEVEL not recognized"

**Symptoms**: Winston logging not working as expected

**Root Cause**: Invalid `LOG_LEVEL` value

**Debugging Steps**:

1. Check current value:
```bash
echo $LOG_LEVEL
```

2. Verify valid values: `error`, `warn`, `info`, `debug`

**Solutions**:

- Fix value in .env file:
```bash
LOG_LEVEL=info  # Or error, warn, debug
```

**Prevention**:
- Document valid values in README
- Add validation in logger.js
- Default to 'info' if invalid

### CSRF Token Mismatches

#### Issue: "Invalid CSRF token"

**Symptoms**: Form submission fails with CSRF error

**Root Cause**: Token mismatch or missing token

**Debugging Steps**:

1. Check if token is in form:
```html
<!-- View page source -->
<input type="hidden" name="_csrf" value="...">
```

2. Check if cookie is set:
```
Browser DevTools → Application → Cookies → __Host-psifi.x-csrf-token
```

3. Verify middleware order:
```javascript
// index.js
app.use(cookieParser());  // Must be before CSRF
app.use(doubleCsrfProtection);  // Must be before routes
```

**Solutions**:

- Add token to form:
```html
<input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

- Ensure csrfToken is passed to template:
```javascript
res.render('view', { csrfToken: req.csrfToken() });
```

- Verify middleware order (cookie-parser before CSRF)

**Prevention**:
- Include token in all form templates
- Add template helper for CSRF token
- Test forms after implementation

### Static File Serving Issues

#### Issue: "CSS/JS files not loading"

**Symptoms**: Styles and scripts return 404

**Root Cause**: Static files middleware not configured

**Debugging Steps**:

1. Check static middleware:
```javascript
// index.js
app.use(express.static('public'));
```

2. Verify file exists:
```bash
ls -la public/css/styles.css
```

3. Check file paths in HTML:
```html
<!-- Should be relative to public/ -->
<link rel="stylesheet" href="/css/styles.css">
```

**Solutions**:

- Add static middleware:
```javascript
app.use(express.static(path.join(__dirname, 'public')));
```

- Fix file paths in templates
- Ensure files exist in public/ directory

**Prevention**:
- Document public/ directory structure
- Use correct paths in templates
- Test static files after deployment

### Flash Messages Not Displaying

#### Issue: "Success/error messages not showing"

**Symptoms**: Flash messages don't appear after form submission

**Root Cause**: Flash middleware not configured or template missing flash display

**Debugging Steps**:

1. Check flash middleware:
```javascript
// index.js
const flash = require('connect-flash');
app.use(flash());
```

2. Check middleware that sets locals:
```javascript
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});
```

3. Check template includes flash partial:
```html
<%- include('partials/flash') %>
```

**Solutions**:

- Add flash middleware
- Add locals middleware
- Include flash partial in templates

**Prevention**:
- Include flash in base template
- Test flash messages after implementation
- Document flash message keys

---

## Performance Debugging

### Identifying Slow Endpoints

**Using Morgan HTTP Logs**:

Morgan doesn't show response times by default in 'combined' format. To add timing:

```javascript
// index.js
// Change from:
app.use(morgan('combined'));

// To custom format with response time:
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) return '-';
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

app.use(morgan(':method :url :status :res[content-length] - :response-time-ms ms'));
```

**Example Output**:
```
GET /admin/dashboard 200 5432 - 234.567 ms
POST /admin/tickets 302 - - 1523.234 ms  # Slow!
```

**Filter for Slow Requests**:

```bash
# Find requests over 1 second (1000ms)
docker-compose logs web | grep -E '[0-9]{4,}\.[0-9]+ ms'

# Find slow POST requests
docker-compose logs web | grep 'POST' | grep -E '[0-9]{4,}\.[0-9]+ ms'
```

### Database Query Optimization

#### Using EXPLAIN ANALYZE

```sql
-- Check query plan
EXPLAIN ANALYZE
SELECT t.*, u.username as assigned_username
FROM tickets t
LEFT JOIN users u ON t.assigned_to = u.id
WHERE t.status = 'open'
ORDER BY t.created_at DESC
LIMIT 20;
```

**Reading EXPLAIN Output**:

- **Seq Scan**: Full table scan (slow for large tables) → Add index
- **Index Scan**: Using index (good)
- **Execution Time**: Total time in milliseconds
- **Planning Time**: Time to plan query

**Example Output**:
```
Limit  (cost=0.00..1.23 rows=20 width=123) (actual time=0.045..0.123 rows=20 loops=1)
  ->  Seq Scan on tickets t  (cost=0.00..456.78 rows=5000 width=123) (actual time=0.043..0.089 rows=20 loops=1)
        Filter: (status = 'open'::text)
        Rows Removed by Filter: 1234
Planning Time: 0.234 ms
Execution Time: 0.345 ms
```

**Interpretation**:
- Seq Scan = Full table scan (consider index on `status`)
- Rows Removed by Filter = 1234 rows scanned but filtered out
- Execution Time = 0.345ms (acceptable)

#### Index Analysis

**Check Existing Indexes**:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Check Index Usage**:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

**Indexes with zero scans are not being used** (consider removing).

**Add Index for Slow Query**:

```sql
-- Create index on frequently queried column
CREATE INDEX idx_tickets_status ON tickets(status);

-- Composite index for multiple columns
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority);

-- Re-run EXPLAIN ANALYZE to verify improvement
EXPLAIN ANALYZE
SELECT * FROM tickets WHERE status = 'open' ORDER BY priority DESC;
```

#### N+1 Query Detection

**Symptoms**: Many queries executed for a single operation

**Example Problem**:

```javascript
// BAD - N+1 queries
const tickets = await Ticket.getAll();  // 1 query
for (const ticket of tickets) {
  const user = await User.findById(ticket.assigned_to);  // N queries!
  ticket.assignedUsername = user ? user.username : null;
}
```

**Solution - Join in Database**:

```javascript
// GOOD - Single query with JOIN
const result = await pool.query(`
  SELECT
    t.*,
    u.username as assigned_username
  FROM tickets t
  LEFT JOIN users u ON t.assigned_to = u.id
  ORDER BY t.created_at DESC
`);
```

**Detection in Logs**:

Enable query logging:

```javascript
// config/database.js (development only!)
pool.on('query', (query) => {
  logger.debug('Database query', { text: query.text });
});
```

If you see many similar queries in quick succession, you likely have an N+1 problem.

### Memory Leak Detection

**Using Node.js Built-in Tools**:

```bash
# Start with heap snapshot
node --expose-gc --inspect index.js

# Connect Chrome DevTools (chrome://inspect)
# Take heap snapshots before and after operation
# Compare to find growing objects
```

**Using process.memoryUsage()**:

```javascript
// Add to routes or middleware
app.use((req, res, next) => {
  const used = process.memoryUsage();
  logger.debug('Memory usage', {
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`
  });
  next();
});
```

**Common Memory Leak Causes**:

1. **Event listeners not removed**
```javascript
// BAD
setInterval(() => { ... }, 1000);  // Runs forever

// GOOD
const interval = setInterval(() => { ... }, 1000);
// Clear when done
clearInterval(interval);
```

2. **Global variables accumulating data**
```javascript
// BAD
const cache = [];  // Global cache grows forever
app.get('/data', (req, res) => {
  cache.push(fetchData());  // Memory leak!
});

// GOOD - Use LRU cache with size limit
const LRU = require('lru-cache');
const cache = new LRU({ max: 100 });
```

3. **Database connections not released**
```javascript
// BAD
const client = await pool.connect();
await client.query('SELECT * FROM users');
// Missing client.release()!

// GOOD
const client = await pool.connect();
try {
  await client.query('SELECT * FROM users');
} finally {
  client.release();
}

// BETTER - Use pool.query() directly
await pool.query('SELECT * FROM users');
```

### CPU Profiling

**Using Node.js --prof**:

```bash
# Run with profiler
node --prof index.js

# Generate load (make requests)
# Stop application (Ctrl+C)

# Process profiler output
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > profile.txt

# Analyze profile.txt for bottlenecks
cat profile.txt | head -50
```

**Using clinic.js** (third-party tool):

```bash
npm install -g clinic

# CPU profiling
clinic doctor -- node index.js

# Flame graph
clinic flame -- node index.js

# Bubble profiler
clinic bubbleprof -- node index.js

# View results in browser
```

### Response Time Analysis

**Add Timing Middleware**:

```javascript
// middleware/timing.js
module.exports = function timingMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests (over 1 second)
    if (duration > 1000) {
      logger.warn('Slow request', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.session.user?.id
      });
    }
  });

  next();
};

// index.js
const timingMiddleware = require('./middleware/timing');
app.use(timingMiddleware);
```

**Analyze Timing Logs**:

```bash
# Find slow requests
grep "Slow request" logs/combined.log | jq .

# Group by endpoint
grep "Slow request" logs/combined.log | jq -r .url | sort | uniq -c | sort -rn
```

### Connection Pool Monitoring

**Add Pool Monitoring**:

```javascript
// config/database.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20
});

// Log pool stats periodically
setInterval(() => {
  logger.info('Connection pool status', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000);  // Every minute
```

**Interpretation**:
- `total`: Total connections in pool
- `idle`: Available connections
- `waiting`: Queued requests waiting for connection

**Warning Signs**:
- `waiting` consistently > 0: Pool too small or queries too slow
- `total` always at `max`: Need to increase pool size or optimize queries
- `idle` always near 0: High load or connection leaks

---

## Debugging Tools & Commands Reference

### Docker Commands

```bash
# ===== Container Management =====

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart web

# Rebuild and start
docker-compose up -d --build web

# View container status
docker-compose ps

# ===== Logs =====

# Watch logs in real-time
docker-compose logs -f web

# Last 100 lines
docker-compose logs --tail=100 web

# Logs from specific time
docker-compose logs --since 30m web

# Both web and database logs
docker-compose logs -f web db

# ===== Container Access =====

# Access web container shell
docker-compose exec web sh

# Access database
docker-compose exec db psql -U ticketing_user -d ticketing_db

# Run commands in container
docker-compose exec web npm run init-db
docker-compose exec web node scripts/seed-admin.js

# ===== Cleanup =====

# Remove stopped containers
docker-compose down

# Remove containers and volumes (DESTROYS DATA)
docker-compose down -v

# Remove all unused containers, networks, images
docker system prune -a

# ===== Inspection =====

# Container details
docker inspect knii_ticketing_web

# Resource usage
docker stats knii_ticketing_web

# Container processes
docker-compose top web
```

### Database Inspection Queries

```sql
-- ===== Users =====

-- List all users
SELECT id, username, email, role, status, login_attempts, last_login_at
FROM users
ORDER BY created_at DESC;

-- Find specific user
SELECT * FROM users WHERE username = 'admin';

-- Locked accounts
SELECT id, username, login_attempts
FROM users
WHERE login_attempts >= 5;

-- Reset login attempts
UPDATE users SET login_attempts = 0 WHERE username = 'admin';

-- Activate user
UPDATE users SET status = 'active' WHERE id = 123;

-- ===== Sessions =====

-- Active sessions count
SELECT COUNT(*) FROM session WHERE expire > NOW();

-- List active sessions
SELECT sid, sess->'user' as user_data, expire
FROM session
WHERE expire > NOW()
ORDER BY expire DESC;

-- Clear all sessions (logout everyone)
TRUNCATE session;

-- Clear sessions for specific user
DELETE FROM session WHERE sess::text LIKE '%"id":123%';

-- ===== Tickets =====

-- Recent tickets
SELECT id, title, status, priority, reporter_email, assigned_to, created_at
FROM tickets
ORDER BY created_at DESC
LIMIT 10;

-- Tickets by status
SELECT status, COUNT(*) as count
FROM tickets
GROUP BY status;

-- Unassigned tickets
SELECT id, title, priority, created_at
FROM tickets
WHERE assigned_to IS NULL
ORDER BY priority DESC;

-- Tickets assigned to user
SELECT id, title, status, priority, created_at
FROM tickets
WHERE assigned_to = 123;

-- ===== Audit Logs =====

-- Recent events
SELECT id, actor_id, action, target_type, target_id, ip_address, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- Failed logins
SELECT created_at, ip_address, details->>'username' as username
FROM audit_logs
WHERE action = 'USER_LOGIN_FAILED'
ORDER BY created_at DESC;

-- Actions by user
SELECT action, target_type, target_id, created_at
FROM audit_logs
WHERE actor_id = 1
ORDER BY created_at DESC;

-- ===== Performance =====

-- Active connections
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'ticketing_db';

-- Running queries
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE state = 'active';

-- Kill stuck query
SELECT pg_terminate_backend(PID);

-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT
  tablename,
  indexname,
  idx_scan as scans
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### PM2 Commands (Production)

```bash
# ===== Process Management =====

# Start application
pm2 start ecosystem.config.js --env production

# Stop application
pm2 stop ticketing-system

# Restart application
pm2 restart ticketing-system

# Graceful reload (zero downtime)
pm2 reload ticketing-system

# Delete from PM2
pm2 delete ticketing-system

# ===== Logs =====

# View logs (combined)
pm2 logs ticketing-system

# Last 100 lines
pm2 logs ticketing-system --lines 100

# Watch logs in real-time
pm2 logs ticketing-system --raw

# Only errors
pm2 logs ticketing-system --err

# Only output
pm2 logs ticketing-system --out

# Flush logs
pm2 flush

# ===== Monitoring =====

# Interactive dashboard
pm2 monit

# Process list
pm2 list

# Detailed info
pm2 show ticketing-system

# CPU and memory
pm2 status

# ===== Cluster =====

# Scale to 4 instances
pm2 scale ticketing-system 4

# Scale to max (CPU cores)
pm2 scale ticketing-system max

# Restart specific instance
pm2 restart ticketing-system-0

# ===== Startup =====

# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect

# ===== Logs Location =====

# Stdout: ~/.pm2/logs/ticketing-system-out.log
# Stderr: ~/.pm2/logs/ticketing-system-error.log
# PM2:    ~/.pm2/pm2.log
```

### Log File Locations and Access

**Development (Docker)**:

```bash
# Console output
docker-compose logs -f web

# Winston logs (inside container)
docker-compose exec web cat logs/error.log
docker-compose exec web cat logs/combined.log

# Follow Winston logs
docker-compose exec web tail -f logs/combined.log
```

**Production (PM2)**:

```bash
# PM2 logs
pm2 logs ticketing-system

# Winston logs (on server filesystem)
tail -f /path/to/app/logs/error.log
tail -f /path/to/app/logs/combined.log

# Search logs
grep "Failed to create ticket" /path/to/app/logs/error.log

# View logs from specific date
grep "2025-12-30" /path/to/app/logs/combined.log
```

**Log Rotation**:

Winston handles rotation automatically:
- Max file size: 5MB
- Max files: 5
- Pattern: `error.log`, `error.log.1`, `error.log.2`, ...

### PostgreSQL Debugging Tools

```bash
# ===== psql Commands =====

# Connect to database
psql -U ticketing_user -d ticketing_db

# Inside psql:
\dt                 # List tables
\d users            # Describe table structure
\di                 # List indexes
\du                 # List users
\l                  # List databases
\x                  # Toggle expanded display
\timing             # Toggle query timing
\q                  # Quit

# ===== pg_dump (Backup) =====

# Backup database
pg_dump -U ticketing_user -d ticketing_db > backup.sql

# Backup specific table
pg_dump -U ticketing_user -d ticketing_db -t users > users_backup.sql

# Compressed backup
pg_dump -U ticketing_user -d ticketing_db | gzip > backup.sql.gz

# ===== pg_restore (Restore) =====

# Restore from backup
psql -U ticketing_user -d ticketing_db < backup.sql

# ===== Connection Info =====

# Show current connections
SELECT * FROM pg_stat_activity;

# Kill specific connection
SELECT pg_terminate_backend(PID);

# Max connections
SHOW max_connections;

# ===== Performance =====

# Enable query logging (edit postgresql.conf)
log_statement = 'all'
log_duration = on

# Or enable for session
SET log_statement = 'all';
```

---

## Debugging Specific Components

### User Authentication Debugging

**Login Flow**:

1. User submits credentials
2. `validateLogin` validator checks format
3. `authService.authenticate()` verifies credentials
4. Session created
5. Redirect to dashboard

**Debug Points**:

```javascript
// routes/auth.js
router.post('/login', loginLimiter, validateLogin, validateRequest, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // DEBUG: Log login attempt
    logger.info('Login attempt', { username, ip: req.ip });

    const user = await authService.authenticate(username, password);

    // DEBUG: Log successful authentication
    logger.info('Authentication successful', { userId: user.id, username: user.username });

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    // DEBUG: Log session creation
    logger.debug('Session created', { sessionId: req.sessionID, userId: user.id });

    await AuditLog.create({
      actorId: user.id,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: user.id,
      details: { username: user.username },
      ipAddress: req.ip
    });

    successRedirect(req, res, AUTH_MESSAGES.LOGIN_SUCCESS, '/admin/dashboard');
  } catch (error) {
    logger.error('Login failed', {
      error: error.message,
      username: req.body.username,
      ip: req.ip
    });

    errorRedirect(req, res, AUTH_MESSAGES.LOGIN_FAILED, '/auth/login');
  }
});
```

**Common Issues**:

| Issue | Debugging | Solution |
|-------|-----------|----------|
| "Invalid credentials" | Check if user exists, verify password | See [Authentication Failures](#authentication-failures) |
| Session not created | Check `req.sessionID`, query session table | See [Session Debugging](#session-debugging) |
| Rate limited | Check IP, review loginLimiter config | See [Rate Limiting Debugging](#rate-limiting-debugging) |
| Account locked | Check `login_attempts >= 5` | Reset attempts: `UPDATE users SET login_attempts = 0 WHERE ...` |

### Ticket Operations Debugging

**Ticket Creation Flow**:

1. User fills form
2. `validateTicketCreate` validates input
3. `ticketService.createTicket()` inserts to database
4. Audit log created
5. Redirect to dashboard

**Debug Points**:

```javascript
// routes/admin.js
router.post('/tickets', requireAuth, validateTicketCreate, validateRequest, async (req, res, next) => {
  try {
    const { title, description, priority, reporter_name, reporter_email, reporter_phone } = req.body;

    // DEBUG: Log ticket creation attempt
    logger.info('Creating ticket', {
      userId: req.session.user.id,
      title: title.substring(0, 50)  // Don't log full content
    });

    const ticket = await ticketService.createTicket({
      title,
      description,
      priority,
      reporter_name,
      reporter_email,
      reporter_phone
    }, req.session.user.id, req.ip);

    // DEBUG: Log successful creation
    logger.info('Ticket created', {
      ticketId: ticket.id,
      userId: req.session.user.id
    });

    successRedirect(req, res, 'Ticket created successfully', '/admin/dashboard');
  } catch (error) {
    logger.error('Failed to create ticket', {
      error: error.message,
      stack: error.stack,
      userId: req.session.user.id
    });
    next(error);
  }
});
```

**Common Issues**:

| Issue | Debugging | Solution |
|-------|-----------|----------|
| Validation errors | Check error_msg flash, review validator | Fix input or validator rules |
| Database errors | Check logs for constraint violations | Verify foreign keys, data types |
| Missing data | Query ticket table | Check if insert succeeded |

### Comment System Debugging

**Comment Creation Flow**:

1. User submits comment
2. `validateCommentCreate` validates input
3. Model inserts to database
4. Audit log created
5. Redirect back to ticket

**Debug Points**:

```javascript
// routes/admin.js
router.post('/tickets/:id/comments', requireAuth, validateCommentCreate, validateRequest, async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { content, is_internal } = req.body;

    // DEBUG: Log comment creation
    logger.info('Creating comment', {
      ticketId,
      userId: req.session.user.id,
      isInternal: is_internal === 'true'
    });

    const comment = await Comment.create({
      ticketId,
      userId: req.session.user.id,
      content,
      isInternal: is_internal === 'true'
    });

    // DEBUG: Log successful creation
    logger.info('Comment created', {
      commentId: comment.id,
      ticketId
    });

    await AuditLog.create({
      actorId: req.session.user.id,
      action: 'COMMENT_CREATED',
      targetType: 'comment',
      targetId: comment.id,
      details: { ticketId },
      ipAddress: req.ip
    });

    successRedirect(req, res, 'Comment added', `/admin/tickets/${ticketId}`);
  } catch (error) {
    logger.error('Failed to create comment', {
      error: error.message,
      ticketId: req.params.id,
      userId: req.session.user.id
    });
    next(error);
  }
});
```

### Validator Debugging (express-validator)

**Debugging Validation Chains**:

```javascript
// validators/ticketValidators.js
const { body, validationResult } = require('express-validator');

const validateTicketCreate = [
  body('title')
    .trim()
    .isLength({ min: 1, max: MAX_LENGTHS.TICKET_TITLE })
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: MAX_LENGTHS.TICKET_DESCRIPTION })
    .withMessage('Description is required and must be less than 5000 characters')
];

// middleware/validation.js
function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // DEBUG: Log validation errors
    logger.warn('Validation failed', {
      errors: errors.array(),
      body: req.body,
      url: req.url
    });

    errors.array().forEach(error => {
      req.flash('error_msg', error.msg);
    });

    return res.redirect('back');
  }

  next();
}
```

**Testing Validators**:

```javascript
// Test validator in isolation
const req = {
  body: {
    title: '',  // Invalid: empty
    description: 'Test description'
  }
};

const res = {};
const next = () => {};

// Run validator
await Promise.all(validateTicketCreate.map(validation => validation.run(req)));

// Check results
const errors = validationResult(req);
console.log(errors.array());
// Output: [{ msg: 'Title is required...', param: 'title', ... }]
```

### Middleware Debugging

**Auth Middleware**:

```javascript
// middleware/auth.js
async function requireAuth(req, res, next) {
  // DEBUG: Log auth check
  logger.debug('Auth check', {
    sessionId: req.sessionID,
    user: req.session.user,
    url: req.url
  });

  if (!req.session.user) {
    logger.warn('Unauthorized access attempt', {
      url: req.url,
      ip: req.ip
    });
    req.flash('error_msg', AUTH_MESSAGES.UNAUTHORIZED);
    return res.redirect('/auth/login');
  }

  // Verify user still exists and is active
  const user = await User.findById(req.session.user.id);
  if (!user || user.status !== 'active') {
    logger.warn('Session user invalid', {
      userId: req.session.user.id,
      userExists: !!user,
      status: user?.status
    });

    req.session.destroy();
    req.flash('error_msg', 'Your session is no longer valid. Please log in again.');
    return res.redirect('/auth/login');
  }

  next();
}
```

**CSRF Middleware**:

```javascript
// Debug CSRF token generation
app.use((req, res, next) => {
  const token = req.csrfToken();
  logger.debug('CSRF token generated', {
    token: token.substring(0, 10) + '...',  // Don't log full token
    sessionId: req.sessionID
  });
  res.locals.csrfToken = token;
  next();
});
```

**Rate Limit Middleware**:

```javascript
// middleware/rateLimiter.js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      endpoint: 'login'
    });
    req.flash('error_msg', 'Too many login attempts. Please try again later.');
    res.redirect('/auth/login');
  }
});
```

### Service Layer Debugging

**Add Logging to Services**:

```javascript
// services/userService.js
class UserService {
  async updateUser(actorId, targetId, updates, ipAddress) {
    logger.info('Updating user', {
      actorId,
      targetId,
      updates: Object.keys(updates)  // Don't log values (may contain PII)
    });

    // Business rule validation
    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      logger.warn('User not found for update', { targetId, actorId });
      throw new Error('User not found');
    }

    if (targetUser.role === 'super_admin' && actorId !== targetId) {
      logger.warn('Unauthorized super admin modification attempt', {
        actorId,
        targetId
      });
      throw new Error('Cannot modify super admin users');
    }

    // ... rest of method
  }
}
```

### Model Layer Debugging

**Add Query Logging**:

```javascript
// models/User.js
class User {
  static async findById(id) {
    logger.debug('Querying user by ID', { id });

    const result = await pool.query(
      'SELECT id, username, email, role, status, created_at, updated_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    logger.debug('User query result', {
      id,
      found: result.rows.length > 0
    });

    return result.rows[0];
  }
}
```

**Enable Query Logging** (development only):

```javascript
// config/database.js
if (process.env.NODE_ENV !== 'production') {
  pool.on('query', (query) => {
    logger.debug('Database query', {
      text: query.text,
      params: query.values
    });
  });
}
```

### Cross-Reference: Test Debugging

For comprehensive test debugging practices, see:
- [docs/testing_rules.md](testing_rules.md)

---

## Debugging Checklists

### Pre-Deployment Debugging Verification

Use this checklist before deploying to production:

- [ ] **Error Handling**
  - [ ] All async route handlers wrapped in try-catch
  - [ ] All errors passed to global error handler via `next(error)`
  - [ ] Global error handler configured and tested
  - [ ] Error responses appropriate for production (no stack traces exposed)

- [ ] **Logging**
  - [ ] Winston logger configured correctly
  - [ ] Log level set appropriately (`info` for production)
  - [ ] Sensitive data not logged (passwords, tokens, PII)
  - [ ] All error logs include stack traces
  - [ ] Log files writable and rotated properly

- [ ] **Environment Variables**
  - [ ] `SESSION_SECRET` set (at least 32 characters)
  - [ ] `DATABASE_URL` set and correct
  - [ ] `NODE_ENV` set to `production`
  - [ ] `LOG_LEVEL` set (or defaults to `info`)
  - [ ] All required variables documented

- [ ] **Database**
  - [ ] Migrations applied successfully
  - [ ] Connection pool configured (max 20 connections)
  - [ ] Foreign keys and constraints verified
  - [ ] Indexes created for frequently queried columns
  - [ ] Session table exists and writable

- [ ] **Session Management**
  - [ ] Session middleware configured before routes
  - [ ] Session store (PostgreSQL) working
  - [ ] Session cookie settings correct (httpOnly, secure, sameSite)
  - [ ] Session expiration configured (24 hours)

- [ ] **Rate Limiting**
  - [ ] Login rate limiter active (10 attempts/15 min)
  - [ ] Ticket submission limiter active (5 submissions/hour)
  - [ ] Rate limit messages user-friendly

- [ ] **CSRF Protection**
  - [ ] CSRF middleware enabled
  - [ ] All forms include CSRF token
  - [ ] POST/PUT/DELETE routes protected
  - [ ] CSRF cookie configured correctly

- [ ] **Security**
  - [ ] Passwords hashed with bcrypt
  - [ ] SQL injection prevented (parameterized queries)
  - [ ] XSS prevented (EJS auto-escaping, helmet middleware)
  - [ ] Audit logging enabled for user actions

- [ ] **Performance**
  - [ ] Database queries optimized
  - [ ] Indexes created where needed
  - [ ] N+1 queries eliminated
  - [ ] Connection pool not exhausted under load

- [ ] **Monitoring**
  - [ ] PM2 configured for cluster mode
  - [ ] Health check endpoint working
  - [ ] Log rotation configured
  - [ ] Error tracking set up (if using external service)

### Production Issue Response Checklist

When a production issue is reported, follow this checklist:

- [ ] **Initial Assessment**
  - [ ] Determine severity (down, degraded, or minor issue)
  - [ ] Check if users are impacted
  - [ ] Estimate number of affected users
  - [ ] Document time issue was first reported

- [ ] **Gather Information**
  - [ ] Check PM2 status: `pm2 status`
  - [ ] Review PM2 logs: `pm2 logs ticketing-system --lines 200`
  - [ ] Check Winston error.log: `tail -100 logs/error.log`
  - [ ] Review audit logs for suspicious activity
  - [ ] Note any recent deployments or changes

- [ ] **Database Health**
  - [ ] Verify database is running
  - [ ] Check active connections: `SELECT COUNT(*) FROM pg_stat_activity`
  - [ ] Look for long-running queries
  - [ ] Check table sizes and disk space
  - [ ] Verify session table is accessible

- [ ] **Application Health**
  - [ ] Test health endpoint: `curl http://localhost:3000/health`
  - [ ] Check if application is responding
  - [ ] Verify static files are serving
  - [ ] Test login flow
  - [ ] Test critical user workflows

- [ ] **Error Analysis**
  - [ ] Identify error patterns in logs
  - [ ] Check stack traces for root cause
  - [ ] Determine if error is recent or ongoing
  - [ ] Cross-reference with recent code changes

- [ ] **Immediate Mitigation**
  - [ ] If down: Restart application (`pm2 restart ticketing-system`)
  - [ ] If database issue: Check connections, restart if needed
  - [ ] If specific feature failing: Disable feature or add rate limiting
  - [ ] If security issue: Invalidate sessions, lock accounts if needed

- [ ] **Communication**
  - [ ] Notify stakeholders of issue
  - [ ] Provide estimated time to resolution
  - [ ] Update status as investigation progresses
  - [ ] Notify when issue is resolved

- [ ] **Post-Incident**
  - [ ] Document root cause
  - [ ] Document resolution steps
  - [ ] Create post-mortem (what happened, why, how to prevent)
  - [ ] Update monitoring/alerting to catch similar issues
  - [ ] Schedule fix for underlying cause if workaround was used

### Performance Issue Checklist

When investigating performance issues:

- [ ] **Identify Slow Operations**
  - [ ] Check Morgan logs for slow requests (>1000ms)
  - [ ] Review Winston logs for slow operations
  - [ ] Identify affected endpoints or features
  - [ ] Determine if issue is intermittent or consistent

- [ ] **Database Performance**
  - [ ] Run EXPLAIN ANALYZE on suspected slow queries
  - [ ] Check for full table scans (Seq Scan)
  - [ ] Verify indexes exist and are being used
  - [ ] Look for N+1 query patterns
  - [ ] Check connection pool usage (total, idle, waiting)
  - [ ] Identify long-running queries in pg_stat_activity

- [ ] **Application Performance**
  - [ ] Check PM2 metrics (CPU, memory)
  - [ ] Look for memory leaks (increasing memory over time)
  - [ ] Check for event loop blocking
  - [ ] Review middleware execution order
  - [ ] Identify synchronous operations in request path

- [ ] **Server Resources**
  - [ ] Check CPU usage: `top` or `htop`
  - [ ] Check memory usage: `free -h`
  - [ ] Check disk I/O: `iostat`
  - [ ] Check network latency
  - [ ] Verify adequate server resources

- [ ] **Optimization Steps**
  - [ ] Add missing database indexes
  - [ ] Optimize slow queries (use JOINs, limit results)
  - [ ] Implement caching for frequently accessed data
  - [ ] Optimize middleware (move expensive operations out of request path)
  - [ ] Consider pagination for large datasets
  - [ ] Use connection pooling efficiently

- [ ] **Testing**
  - [ ] Test optimization in staging environment
  - [ ] Measure performance improvement
  - [ ] Verify no regressions introduced
  - [ ] Load test to ensure scalability

- [ ] **Monitoring**
  - [ ] Set up alerts for slow queries
  - [ ] Monitor connection pool usage
  - [ ] Track response times over time
  - [ ] Set up APM if performance issues are frequent

---

## Advanced Debugging Topics

### Understanding the Audit Trail

**Audit Log Structure**:

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Tracing User Actions**:

```sql
-- Complete action history for a user
SELECT
  created_at,
  action,
  target_type,
  target_id,
  details,
  ip_address
FROM audit_logs
WHERE actor_id = 123
ORDER BY created_at DESC;

-- Actions on a specific ticket
SELECT
  al.created_at,
  u.username as actor,
  al.action,
  al.details
FROM audit_logs al
JOIN users u ON al.actor_id = u.id
WHERE al.target_type = 'ticket' AND al.target_id = 456
ORDER BY al.created_at ASC;

-- Timeline reconstruction
SELECT
  al.created_at,
  u.username as actor,
  al.action,
  al.target_type,
  al.target_id,
  al.details
FROM audit_logs al
LEFT JOIN users u ON al.actor_id = u.id
WHERE al.created_at BETWEEN '2025-12-30 10:00:00' AND '2025-12-30 11:00:00'
ORDER BY al.created_at ASC;
```

### Debugging Race Conditions

**Common Race Conditions**:

1. **Concurrent User Updates**

```javascript
// PROBLEM: Two requests updating same user simultaneously
// Request 1: UPDATE users SET login_attempts = 3 WHERE id = 123
// Request 2: UPDATE users SET login_attempts = 3 WHERE id = 123
// Result: login_attempts = 3 (should be 4 or 5)

// SOLUTION: Use atomic increment
await pool.query(
  'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = $1',
  [userId]
);
```

2. **Session Race Conditions**

```javascript
// PROBLEM: Session read/write race
// Request 1 reads session.cart = []
// Request 2 reads session.cart = []
// Request 1 writes session.cart = [item1]
// Request 2 writes session.cart = [item2]
// Result: cart = [item2] (lost item1)

// SOLUTION: Use session locking or atomic operations
req.session.cart = req.session.cart || [];
req.session.cart.push(newItem);
await new Promise((resolve, reject) => {
  req.session.save((err) => err ? reject(err) : resolve());
});
```

**Debugging Techniques**:

1. Add request ID logging:
```javascript
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(7);
  logger.debug('Request started', { requestId: req.id, url: req.url });
  next();
});
```

2. Log timing:
```javascript
logger.debug('Operation started', { requestId: req.id, operation: 'updateUser' });
await updateUser();
logger.debug('Operation completed', { requestId: req.id, operation: 'updateUser' });
```

3. Use database transactions:
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE users SET ... WHERE id = $1', [id]);
  await client.query('INSERT INTO audit_logs ...', [data]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Handling Concurrent User Sessions

**Multiple Logins from Same User**:

```sql
-- Find users with multiple active sessions
SELECT
  sess->'user'->>'id' as user_id,
  sess->'user'->>'username' as username,
  COUNT(*) as session_count
FROM session
WHERE expire > NOW()
GROUP BY sess->'user'->>'id', sess->'user'->>'username'
HAVING COUNT(*) > 1
ORDER BY session_count DESC;

-- Clear all but most recent session for a user
-- (Advanced - requires custom logic)
```

**Session Conflicts**:

- Same user logged in on multiple devices: Expected behavior
- Session hijacking: Look for different IP addresses in audit logs
- Session fixation: Regenerate session ID after login (already implemented)

### Timezone Debugging

**Database Timezone**:

```sql
-- Check PostgreSQL timezone
SHOW timezone;

-- Set timezone for session
SET timezone = 'UTC';

-- Store all timestamps in UTC
CREATE TABLE tickets (
  created_at TIMESTAMP DEFAULT NOW() AT TIME ZONE 'UTC'
);
```

**Application Timezone**:

```javascript
// Store dates in UTC
const now = new Date().toISOString();  // Always UTC

// Display in user's timezone (frontend)
<script>
  const utcDate = '<%= ticket.created_at %>';
  const localDate = new Date(utcDate).toLocaleString();
  document.getElementById('date').textContent = localDate;
</script>
```

**Common Issues**:

- Timestamp stored without timezone: Use `TIMESTAMP WITH TIME ZONE` or store in UTC
- Comparing dates across timezones: Always convert to UTC before comparison
- Displaying dates: Convert to user's local timezone in frontend

### Character Encoding Issues

**Database Encoding**:

```sql
-- Check database encoding
SHOW server_encoding;  -- Should be UTF8

-- Check client encoding
SHOW client_encoding;  -- Should be UTF8
```

**Application Encoding**:

```javascript
// Set UTF-8 in Content-Type header
res.setHeader('Content-Type', 'text/html; charset=utf-8');

// EJS templates automatically use UTF-8
```

**Common Issues**:

- Special characters corrupted: Check database and client encoding
- Emoji not displaying: Ensure UTF-8 encoding throughout stack
- File upload encoding: Specify charset in multipart/form-data

### Future Enhancements (Roadmap)

**Request Correlation IDs**:

Add unique ID to each request to trace through all layers:

```javascript
// Middleware
const { v4: uuidv4 } = require('uuid');

app.use((req, res, next) => {
  req.correlationId = uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Include in all logs
logger.info('Request received', {
  correlationId: req.correlationId,
  method: req.method,
  url: req.url
});
```

**Distributed Tracing**:

For microservices or complex workflows:
- OpenTelemetry
- Jaeger
- Zipkin

**APM Integration**:

Application Performance Monitoring:
- New Relic
- Datadog
- AppDynamics
- Elastic APM

**Error Codes and Categorization**:

Standardized error codes for programmatic handling:

```javascript
class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.code = code;  // e.g., 'USER_NOT_FOUND', 'INVALID_CREDENTIALS'
    this.statusCode = statusCode;
  }
}

throw new AppError('User not found', 'USER_NOT_FOUND', 404);
```

---

## Conclusion

This document provides comprehensive debugging and troubleshooting guidance for the KNII Ticketing System. By following these practices, you can:

- Quickly identify and resolve issues
- Maintain system observability
- Prevent recurring problems
- Ensure production stability

**Remember**:
- Log with context
- Use structured logging
- Preserve error stacks
- Avoid logging sensitive data
- Debug systematically

For additional resources, see:
- [docs/node_js.md](node_js.md) - Node.js development standards
- [docs/testing_rules.md](testing_rules.md) - Testing practices
- [CLAUDE.md](../CLAUDE.md) - Project overview

---

**Version History**:
- 1.0 (December 2025) - Initial release

**Feedback**: Report issues or suggest improvements via project issue tracker.
