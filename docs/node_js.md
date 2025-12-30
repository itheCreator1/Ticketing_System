# Node.js Development Rules - KNII Ticketing System

**Version:** 2.0
**Last Updated:** December 2025
**Target Project:** KNII Ticketing System (Node.js 20 + Express 5 + PostgreSQL 16)

---

## Table of Contents

1. [Project Context](#project-context)
2. [Quick Reference](#quick-reference)
3. [Global Node.js Principles](#global-nodejs-principles-mandatory)
4. [Project Architecture Patterns](#project-architecture-patterns)
5. [Express.js Best Practices](#expressjs-best-practices)
6. [Async/Await Patterns](#asyncawait-patterns)
7. [Database Best Practices](#database-best-practices)
8. [Security Best Practices](#security-best-practices)
9. [Session Management](#session-management-knii-implementation)
10. [Rate Limiting](#rate-limiting-knii-implementation)
11. [Error Handling](#error-handling-knii-implementation)
12. [Logging Best Practices](#logging-best-practices)
13. [Performance Patterns](#performance-patterns)
14. [Environment Configuration](#environment-configuration)
15. [Code Organization Patterns](#code-organization-patterns)
16. [Response Helpers](#response-helpers-knii-utilities)
17. [Constants and Enums](#constants-and-enums-knii-pattern)
18. [Validation Patterns](#validation-patterns-knii-implementation)
19. [Migration Best Practices](#migration-best-practices)
20. [Docker Configuration](#docker-configuration-knii-setup)
21. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
22. [Common Troubleshooting](#common-troubleshooting)
23. [Testing Considerations](#testing-considerations)
24. [Code Review Checklist](#code-review-checklist-knii-standards)

---

## How to Use This Document

**For New Developers**:
1. Read [Project Context](#project-context) and [Quick Reference](#quick-reference) first
2. Review [Global Node.js Principles](#global-nodejs-principles-mandatory)
3. Study the architectural flow and code templates
4. Reference specific sections as needed during development

**For Code Reviews**:
- Jump directly to [Code Review Checklist](#code-review-checklist-knii-standards)
- Cross-reference with relevant sections for detailed explanations

**For Debugging**:
- Start with [Common Troubleshooting](#common-troubleshooting)
- Check [Error Handling](#error-handling-knii-implementation) patterns

**For Production Deployment**:
- Review [Docker Configuration](#docker-configuration-knii-setup)
- Complete the production deployment checklist

**Quick Search Tips**:
- Use Ctrl/Cmd+F to search for specific topics
- All section headers are linked in the Table of Contents
- Code examples are tagged with `// CORRECT` or `// INCORRECT`

---

You are Claude Code operating with full access to the KNII Ticketing System (Node.js/Express/PostgreSQL).

Your primary responsibility is to ensure that this project follows professional Node.js development practices, security standards, and architectural patterns throughout the entire lifecycle of the project.

You MUST actively maintain code quality, security, performance, and scalability as first-class engineering principles.

## Project Context

**Stack:** Node.js 20, Express 5, PostgreSQL 16, EJS templates, Docker
**Architecture:** Service-oriented with clear separation between routes, services, models, and middleware
**Authentication:** Session-based with express-session and PostgreSQL session store

---

## Quick Reference

### Common Development Commands

```bash
# Docker Development
docker-compose up -d              # Start all services
docker-compose logs -f web        # Watch application logs
docker-compose down               # Stop all services
docker-compose exec web npm run init-db  # Run migrations

# Database Access
docker-compose exec db psql -U ticketing_user -d ticketing_db

# Non-Docker Development
npm install                       # Install dependencies
npm run init-db                   # Run migrations
npm run dev                       # Start with nodemon
npm start                         # Start production mode
```

### Core Architectural Flow

```
HTTP Request
  ↓
Route (routes/)
  ├─ Authentication Middleware (middleware/auth.js)
  ├─ Validation Chains (validators/)
  └─ validateRequest (middleware/validation.js)
  ↓
Service Layer (services/)
  ├─ Business Logic
  ├─ Validation
  └─ Calls Models
  ↓
Model Layer (models/)
  ├─ Database Queries (Parameterized)
  └─ Returns Raw Data
  ↓
Service Transforms/Returns
  ↓
Route Responds (successRedirect/errorRedirect)
```

### Essential Patterns Quick Reference

**Route Handler Template**:
```javascript
router.post('/resource/:id',
  requireAuth,                    // Authentication
  requireAdmin,                   // Authorization
  validateResourceUpdate,         // Validation chains
  validateRequest,                // Check validation results
  async (req, res, next) => {     // Handler
    try {
      await resourceService.update(req.params.id, req.body, req.session.user.id);
      successRedirect(req, res, 'Updated successfully', '/admin/resources');
    } catch (error) {
      next(error);                // Always pass to error handler
    }
  }
);
```

**Service Method Template**:
```javascript
async updateResource(resourceId, updates, userId) {
  const resource = await Resource.findById(resourceId);

  if (!resource) {
    const error = new Error('Resource not found');
    error.status = 404;
    throw error;
  }

  // Business logic validation
  if (!this.isValidUpdate(updates)) {
    const error = new Error('Invalid update');
    error.status = 400;
    throw error;
  }

  const updated = await Resource.update(resourceId, updates);

  await AuditLog.create({
    actorId: userId,
    action: 'resource_updated',
    targetType: 'resource',
    targetId: resourceId,
    details: { ...updates },
    ipAddress: req.ip
  });

  return updated;
}
```

**Model Method Template**:
```javascript
static async findById(id) {
  const result = await pool.query(
    'SELECT * FROM resources WHERE id = $1',
    [id]
  );
  return result.rows[0];
}
```

---

## Global Node.js Principles (Mandatory)

1. **Asynchronous First**: All I/O operations MUST be asynchronous. Never use synchronous methods in production code.
2. **Error Handling**: Every async operation MUST have proper error handling. No silent failures.
3. **Security by Default**: Treat all user input as untrusted. Validate, sanitize, and escape everything.
4. **Database Safety**: ALWAYS use parameterized queries. SQL injection is non-negotiable.
5. **Environment Configuration**: Never hardcode secrets. Always use environment variables.
6. **Logging**: Use structured logging (Winston). Log at appropriate levels with context.
7. **Performance**: Be mindful of blocking operations, memory leaks, and N+1 queries.

---

## Project Architecture Patterns

### Directory Structure (KNII Ticketing System)

```
KNII_Ticketing/
├── config/
│   ├── database.js          # PostgreSQL connection pool
│   └── session.js           # Session configuration (PostgreSQL store)
├── constants/
│   ├── enums.js             # TICKET_STATUS, TICKET_PRIORITY, USER_ROLE
│   ├── messages.js          # FLASH_KEYS, error/success messages
│   └── validation.js        # Validation constants, regex patterns
├── middleware/
│   ├── auth.js              # requireAuth, requireAdmin
│   ├── errorHandler.js      # Centralized error handling
│   ├── rateLimiter.js       # loginLimiter, generalLimiter
│   └── validation.js        # validateRequest middleware
├── migrations/              # 001-006 SQL migration files
├── models/
│   ├── User.js              # User CRUD (static class)
│   ├── Ticket.js            # Ticket CRUD
│   ├── Comment.js           # Comment CRUD
│   └── AuditLog.js          # Audit log operations
├── routes/
│   ├── public.js            # Homepage, static pages
│   ├── auth.js              # Login/logout
│   ├── admin.js             # Admin dashboard, ticket management
│   └── users.js             # User management routes
├── services/
│   ├── authService.js       # Authentication logic
│   ├── ticketService.js     # Ticket business logic
│   └── userService.js       # User business logic
├── utils/
│   ├── passwordValidator.js # Password strength validation
│   └── responseHelpers.js   # successRedirect, errorRedirect
├── validators/
│   ├── authValidators.js    # Login validation chains
│   ├── ticketValidators.js  # Ticket validation chains
│   └── userValidators.js    # User validation chains
├── views/                   # EJS templates with partials
├── public/                  # Static CSS/JS
└── scripts/
    ├── init-db.js           # Run migrations
    ├── seed-admin.js        # Create first admin user
    └── docker-entrypoint.sh # Docker initialization
```

**Critical Rules**:
- Routes call services, services call models (never models directly from routes)
- All database queries use parameterized statements (pool.query with $1, $2)
- Error handling: catch blocks MUST use next(error) to pass to errorHandler
- Validation: express-validator chains → validateRequest middleware → route handler

---

## Express.js Best Practices

### Route Organization (KNII Pattern)

**CORRECT Pattern** (from routes/admin.js):
```javascript
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const ticketService = require('../services/ticketService');
const { validateTicketUpdate } = require('../validators/ticketValidators');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');

// Apply authentication to ALL admin routes
router.use(requireAuth);

// Update ticket status route
router.post('/tickets/:id/update',
  requireAdmin,
  validateTicketUpdate,
  validateRequest,
  async (req, res, next) => {
    try {
      await ticketService.updateTicket(req.params.id, req.body, req.session.user.id);
      successRedirect(req, res, 'Ticket updated successfully', `/admin/tickets/${req.params.id}`);
    } catch (error) {
      next(error);  // ALWAYS pass to global error handler
    }
  }
);

module.exports = router;
```

**INCORRECT Pattern** (never do this):
```javascript
// DON'T DO THIS - Multiple violations
router.post('/tickets/:id/update', async (req, res) => {
  // ❌ No authentication check
  // ❌ No validation
  // ❌ No try-catch
  // ❌ Direct model access instead of service layer
  // ❌ SQL injection vulnerability
  const ticket = await pool.query(
    'UPDATE tickets SET status = ' + req.body.status  // SQL injection!
  );
  res.json(ticket);  // ❌ No error handling
});
```

### Middleware Chain Pattern

**Order matters**:
1. Authentication (`requireAuth`)
2. Authorization (`requireAdmin`, `requireSuperAdmin`)
3. Validation (`validateTicketId`, `validateTicketUpdate`)
4. Validation runner (`validateRequest`)
5. Route handler

**Example**:
```javascript
router.post('/:id',
  requireAuth,           // 1. Check if logged in
  requireSuperAdmin,     // 2. Check if has permission
  validateUserUpdate,    // 3. Validate input
  validateRequest,       // 4. Run validation and return errors
  async (req, res, next) => {  // 5. Execute business logic
    // ...
  }
);
```

---

## Async/Await Patterns

### ALWAYS Use Try-Catch

**CORRECT**:
```javascript
router.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    if (!ticket) {
      return errorRedirect(req, res, 'Ticket not found', '/admin/dashboard');
    }
    res.render('admin/ticket-detail', { ticket });
  } catch (error) {
    logger.error('Error fetching ticket', {
      ticketId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});
```

**INCORRECT**:
```javascript
// DON'T DO THIS - Unhandled promise rejection
router.get('/tickets/:id', async (req, res) => {
  const ticket = await ticketService.getTicketById(req.params.id);
  res.render('admin/ticket-detail', { ticket });
});
```

### Parallel vs Sequential Operations

**Use Promise.all for independent operations**:
```javascript
// CORRECT - Parallel execution
async function getDashboardData() {
  const [tickets, users, stats] = await Promise.all([
    Ticket.findAll(),
    User.findAll(),
    getStatistics()
  ]);
  return { tickets, users, stats };
}

// INCORRECT - Sequential execution (slower)
async function getDashboardData() {
  const tickets = await Ticket.findAll();
  const users = await User.findAll();
  const stats = await getStatistics();
  return { tickets, users, stats };
}
```

**Use sequential for dependent operations**:
```javascript
// CORRECT - Operations depend on each other
async function createTicketWithComment(ticketData, commentData) {
  const ticket = await Ticket.create(ticketData);
  const comment = await Comment.create({
    ticket_id: ticket.id,
    ...commentData
  });
  return { ticket, comment };
}
```

---

## Database Best Practices

### Parameterized Queries (NON-NEGOTIABLE)

**CORRECT**:
```javascript
static async findById(id) {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}
```

**INCORRECT - SQL INJECTION VULNERABILITY**:
```javascript
// NEVER DO THIS
static async findById(id) {
  const result = await pool.query(
    `SELECT * FROM users WHERE id = ${id}`
  );
  return result.rows[0];
}
```

### Dynamic Query Building

**CORRECT Pattern**:
```javascript
static async findAll(filters = {}) {
  const params = [];
  let paramIndex = 1;
  const conditions = [];

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.priority) {
    conditions.push(`priority = $${paramIndex}`);
    params.push(filters.priority);
    paramIndex++;
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const query = `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}
```

### Connection Pool Management

**DO**:
- Use a single pool instance (singleton pattern)
- Configure appropriate pool size for your workload
- Handle pool errors at the application level
- Close connections gracefully on shutdown

**DON'T**:
- Create new pools for each query
- Ignore pool error events
- Keep connections open unnecessarily
- Use `pool.end()` except during shutdown

---

## Security Best Practices

### Input Validation

**ALWAYS validate at multiple layers**:
1. Client-side (UX, not security)
2. Route validators (express-validator)
3. Service layer (business rules)
4. Database constraints

**Example**:
```javascript
// 1. Validator
const validateUserCreate = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .custom(async (value) => {
      const exists = await User.findByUsername(value);
      if (exists) throw new Error('Username already taken');
      return true;
    }),
  // ...
];

// 2. Service layer
async createUser(userData) {
  // Business rule validation
  if (userData.role === 'super_admin') {
    // Additional checks for super admin creation
  }
  return await User.create(userData);
}

// 3. Database
CREATE TABLE users (
  username VARCHAR(50) UNIQUE NOT NULL CHECK (length(username) >= 3),
  -- ...
);
```

### Password Security

**MANDATORY Requirements**:
- Hash with bcrypt (never MD5, SHA-1, or plain text)
- Cost factor minimum 10 (current: 10)
- Never log passwords (even hashed)
- Never include passwords in API responses
- Separate model methods for password operations

**Example**:
```javascript
// CORRECT
class User {
  // Public method - NO password
  static async findById(id) {
    const result = await pool.query(
      'SELECT id, username, email, role, status FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Auth-only method - includes password
  static async findByUsernameWithPassword(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  }

  static async create({ username, email, password, role }) {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, password_hash, role]
    );
    return result.rows[0];  // No password in return
  }
}
```

### Session Management (KNII Implementation)

**Session Configuration** (from config/session.js):
```javascript
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./database');

const sessionConfig = {
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: false  // Use migrations instead
  }),
  secret: process.env.SESSION_SECRET,  // MINIMUM 32 chars in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    httpOnly: true,                // Prevent XSS attacks
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'strict'             // CSRF protection
  }
};

module.exports = sessionConfig;
```

**Session Data Structure**:
```javascript
// ONLY store these fields in session:
req.session.user = {
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role
};

// NEVER store:
// - password_hash
// - sensitive personal data
// - large objects
```

**Authentication Middleware** (from middleware/auth.js):
```javascript
const User = require('../models/User');

// Check if user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error_msg', 'Please log in to access this page');
    return res.redirect('/auth/login');
  }
  next();
}

// Check if user is admin
async function requireAdmin(req, res, next) {
  if (!req.session.user) {
    req.flash('error_msg', 'Please log in to access this page');
    return res.redirect('/auth/login');
  }

  try {
    // Re-fetch user to ensure role is current
    const user = await User.findById(req.session.user.id);

    if (!user || user.role !== 'admin') {
      req.flash('error_msg', 'You do not have permission to access this page');
      return res.redirect('/');
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireAuth, requireAdmin };
```

**Login Flow** (from routes/auth.js):
```javascript
router.post('/login',
  loginLimiter,              // Rate limiting
  validateLogin,             // Input validation
  validateRequest,           // Check validation results
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      // Use authService for business logic
      const user = await authService.authenticate(username, password);

      if (!user) {
        req.flash('error_msg', 'Invalid username or password');
        return res.redirect('/auth/login');
      }

      // Store MINIMAL data in session
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };

      req.flash('success_msg', 'Login successful');
      res.redirect('/admin/dashboard');
    } catch (error) {
      next(error);
    }
  }
);
```

### CSRF Protection

**ALWAYS include CSRF tokens in state-changing operations**:
```ejs
<form method="POST" action="/admin/users/<%= user.id %>">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <!-- form fields -->
</form>
```

### Rate Limiting (KNII Implementation)

**Rate Limiter Configuration** (middleware/rateLimiter.js):
```javascript
const rateLimit = require('express-rate-limit');

// Login rate limiting - strict
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 login attempts
  message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,       // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false
});

// General rate limiting - moderate
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter,
  generalLimiter
};
```

**Usage in Routes**:
```javascript
const { loginLimiter } = require('../middleware/rateLimiter');

// Apply strict rate limiting to auth endpoints
router.post('/login',
  loginLimiter,           // Rate limit BEFORE validation
  validateLogin,
  validateRequest,
  async (req, res, next) => {
    // Login logic
  }
);

// Apply to all routes in app.js
const { generalLimiter } = require('./middleware/rateLimiter');
app.use(generalLimiter);  // Global rate limiting
```

**Best Practices**:
- Apply strictest limits to authentication endpoints
- Apply rate limits BEFORE validation middleware
- Use different limits for different endpoint types
- Consider whitelisting certain IPs if needed
- Log rate limit violations for security monitoring

---

## Error Handling (KNII Implementation)

### Centralized Error Handler (middleware/errorHandler.js)

**Production-ready error handler**:
```javascript
function errorHandler(err, req, res, next) {
  // Log all errors with context
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    user: req.session?.user?.username,
    timestamp: new Date().toISOString()
  });

  const status = err.status || 500;

  // Different response based on environment
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred. Please try again later.'
    : err.message;

  // Handle both HTML and JSON responses
  if (req.accepts('html')) {
    res.status(status).render('errors/error', {
      message,
      status,
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  } else {
    res.status(status).json({
      error: {
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  }
}

module.exports = errorHandler;
```

**Application Setup** (app.js):
```javascript
const errorHandler = require('./middleware/errorHandler');

// ... all routes ...

// Error handler MUST be last middleware
app.use(errorHandler);
```

**Error View Template** (views/errors/error.ejs):
```ejs
<!DOCTYPE html>
<html>
<head>
  <title>Error <%= status %></title>
</head>
<body>
  <h1>Error <%= status %></h1>
  <p><%= message %></p>

  <% if (process.env.NODE_ENV === 'development' && error.stack) { %>
    <pre><%= error.stack %></pre>
  <% } %>

  <a href="/">Return to Home</a>
</body>
</html>
```

### Route Error Handling Pattern

**ALWAYS use next(error)**:
```javascript
router.post('/tickets',
  requireAuth,
  validateTicketCreate,
  validateRequest,
  async (req, res, next) => {
    try {
      const ticket = await ticketService.createTicket(req.body, req.session.user.id);
      successRedirect(req, res, 'Ticket created successfully', `/admin/tickets/${ticket.id}`);
    } catch (error) {
      // ALWAYS pass to error handler - don't try to handle here
      next(error);
    }
  }
);
```

### Service Layer Error Pattern

**Throw descriptive errors for business logic violations**:
```javascript
class TicketService {
  async updateTicket(ticketId, updates, userId) {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      // Business logic error - throw descriptive message
      const error = new Error('Ticket not found');
      error.status = 404;
      throw error;
    }

    if (updates.status && !this.isValidStatusTransition(ticket.status, updates.status)) {
      const error = new Error(`Cannot transition from ${ticket.status} to ${updates.status}`);
      error.status = 400;
      throw error;
    }

    // Proceed with update
    const updated = await Ticket.update(ticketId, updates);

    await AuditLog.create({
      actorId: userId,
      action: 'ticket_updated',
      targetType: 'ticket',
      targetId: ticketId,
      details: { ...updates },
      ipAddress: req.ip
    });

    return updated;
  }

  async deleteUser(actorId, targetId, ipAddress) {
    const target = await User.findById(targetId);

    if (!target) {
      throw new Error('User not found');
    }

    if (actorId === targetId) {
      throw new Error('Cannot delete yourself');
    }

    if (target.role === 'super_admin') {
      const count = await User.countActiveSuperAdmins();
      if (count <= 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    await User.softDelete(targetId);
    await AuditLog.create({...});
    return true;
  }
}
```

---

## Logging Best Practices

### Structured Logging with Winston

**DO**:
```javascript
// Good logging with context
logger.info('User logged in', {
  userId: user.id,
  username: user.username,
  ip: req.ip
});

logger.error('Database query failed', {
  query: 'SELECT * FROM users',
  error: err.message,
  stack: err.stack,
  userId: req.session.user?.id
});

logger.warn('Rate limit exceeded', {
  ip: req.ip,
  endpoint: req.path
});
```

**DON'T**:
```javascript
// Bad - No context
console.log('User logged in');

// Bad - Sensitive data
logger.info('Login attempt', {
  username: user.username,
  password: password  // NEVER LOG PASSWORDS
});

// Bad - Using console in production
console.error(error);
```

### Log Levels

- **error**: Application errors, exceptions, failures
- **warn**: Warning conditions, rate limits, deprecated usage
- **info**: General information, user actions, state changes
- **debug**: Detailed debugging information (development only)

### Current KNII Implementation

**Note**: KNII currently uses `console.error` for logging. Below is the recommended Winston migration path for production.

**Current Error Logging** (middleware/errorHandler.js):
```javascript
console.error('Error:', {
  message: err.message,
  stack: err.stack,
  url: req.url,
  method: req.method,
  user: req.session?.user?.username,
  timestamp: new Date().toISOString()
});
```

### Winston Migration Guide

**Step 1: Install Winston**
```bash
npm install winston winston-daily-rotate-file
```

**Step 2: Create Logger** (utils/logger.js):
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

**Step 3: Replace console.error**
```javascript
// Before
console.error('Error:', { message: err.message });

// After
const logger = require('../utils/logger');
logger.error('Error occurred', {
  message: err.message,
  stack: err.stack,
  url: req.url
});
```

### What NEVER to Log

- Passwords (plain text or hashed)
- Session secrets or API keys
- Credit card numbers or PII
- JWT tokens
- Database connection strings with credentials

---

## Performance Patterns

### Database Query Optimization

**DO**:
- Use indexes on frequently queried columns
- Limit result sets with LIMIT clauses
- Use SELECT specific columns, not SELECT *
- Batch operations when possible
- Use database transactions for related operations

**Example**:
```javascript
// GOOD - Specific columns, indexed where clause
static async findByUsername(username) {
  const result = await pool.query(
    'SELECT id, username, email, role, status FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0];
}

// BAD - SELECT *, no index
static async findByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return result.rows[0];
}
```

### Memory Management

**Avoid memory leaks**:
- Don't store large objects in global scope
- Clean up event listeners
- Close database connections properly
- Stream large files instead of loading into memory

**Example**:
```javascript
// GOOD - Stream large file
router.get('/export', async (req, res) => {
  const stream = await generateLargeCSV();
  res.setHeader('Content-Type', 'text/csv');
  stream.pipe(res);
});

// BAD - Load entire file into memory
router.get('/export', async (req, res) => {
  const csvData = await generateLargeCSV();
  res.send(csvData);  // Could cause memory issues
});
```

### Caching Strategies

**When to cache**:
- Expensive database queries
- External API calls
- Computed values that change infrequently

**Example**:
```javascript
// Simple in-memory cache with TTL
const cache = new Map();

async function getCachedStats() {
  const cacheKey = 'dashboard:stats';
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const stats = await computeExpensiveStats();
  cache.set(cacheKey, {
    data: stats,
    expiresAt: Date.now() + (5 * 60 * 1000)  // 5 minutes
  });

  return stats;
}
```

---

## Environment Configuration

### Required Environment Variables

**NEVER hardcode**:
- Database credentials
- Session secrets
- API keys
- Encryption keys
- Email credentials

**ALWAYS use .env**:
```javascript
// CORRECT
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  // ...
};

// INCORRECT
const sessionConfig = {
  secret: 'my-secret-key',  // NEVER DO THIS
  // ...
};
```

### Environment Validation

**Validate on startup**:
```javascript
// config/session.js
const sessionConfig = {
  secret: (() => {
    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET environment variable is required');
    }
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }
    return process.env.SESSION_SECRET;
  })(),
  // ...
};
```

---

## Code Organization Patterns

### Service Layer Pattern (KNII Implementation)

**Services contain business logic** (from services/ticketService.js):
```javascript
// services/ticketService.js
const Ticket = require('../models/Ticket');
const AuditLog = require('../models/AuditLog');
const { TICKET_STATUS, TICKET_PRIORITY } = require('../constants/enums');

class TicketService {
  async createTicket(ticketData, createdBy) {
    // Business rule: Validate status and priority
    if (!Object.values(TICKET_STATUS).includes(ticketData.status)) {
      throw new Error('Invalid ticket status');
    }

    // Create ticket
    const ticket = await Ticket.create({
      ...ticketData,
      created_by: createdBy
    });

    // Audit logging
    await AuditLog.create({
      actorId: createdBy,
      action: 'ticket_created',
      targetType: 'ticket',
      targetId: ticket.id,
      details: { title: ticketData.title, priority: ticketData.priority },
      ipAddress: req.ip
    });

    return ticket;
  }

  async updateTicket(ticketId, updates, userId) {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Business rule: Check status transition validity
    if (updates.status && !this.isValidStatusTransition(ticket.status, updates.status)) {
      throw new Error('Invalid status transition');
    }

    const updated = await Ticket.update(ticketId, updates);

    await AuditLog.create({
      actorId: userId,
      action: 'ticket_updated',
      targetType: 'ticket',
      targetId: ticketId,
      details: updates,
      ipAddress: req.ip
    });

    return updated;
  }

  isValidStatusTransition(currentStatus, newStatus) {
    // Business logic for status transitions
    const validTransitions = {
      [TICKET_STATUS.OPEN]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CLOSED],
      [TICKET_STATUS.IN_PROGRESS]: [TICKET_STATUS.OPEN, TICKET_STATUS.CLOSED],
      [TICKET_STATUS.CLOSED]: []
    };
    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}

module.exports = new TicketService();  // Singleton export
```

**Routes orchestrate services** (from routes/admin.js):
```javascript
const ticketService = require('../services/ticketService');

router.post('/tickets/:id/update',
  requireAuth,
  requireAdmin,
  validateTicketUpdate,
  validateRequest,
  async (req, res, next) => {
    try {
      // Route handles HTTP concerns, delegates business logic to service
      await ticketService.updateTicket(
        req.params.id,
        req.body,
        req.session.user.id
      );
      successRedirect(req, res, 'Ticket updated successfully', `/admin/tickets/${req.params.id}`);
    } catch (error) {
      // Always pass errors to centralized error handler
      next(error);
    }
  }
);
```

### Model Layer Pattern (KNII Implementation)

**Models are data access objects** (from models/Ticket.js):
```javascript
const pool = require('../config/database');

class Ticket {
  // Static methods only - no instances created

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM tickets WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async create(ticketData) {
    const { title, description, status, priority, assigned_to, created_by } = ticketData;
    const result = await pool.query(
      `INSERT INTO tickets (title, description, status, priority, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, status, priority, assigned_to, created_by]
    );
    return result.rows[0];
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Dynamic query building with parameterized queries
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    values.push(id);  // WHERE clause parameter

    const result = await pool.query(
      `UPDATE tickets SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.assigned_to) {
      conditions.push(`assigned_to = $${paramIndex}`);
      params.push(filters.assigned_to);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  }
}

module.exports = Ticket;

// Usage: const ticket = await Ticket.findById(123);
//        const tickets = await Ticket.findAll({ status: 'open' });
```

**Critical Rules**:
- **Never create model instances** - All methods are static
- **Never put business logic in models** - Models only handle data access
- **Always use parameterized queries** - SQL injection prevention is mandatory
- **Never access other models from models** - Keep models independent
- **Return raw database results** - Let services handle transformation
- **Never handle HTTP concerns in models** - No req/res objects, no redirects

---

## Response Helpers (KNII Utilities)

### Standardized Response Pattern (utils/responseHelpers.js)

**Success and error redirects with flash messages**:
```javascript
function successRedirect(req, res, message, redirectPath) {
  req.flash('success_msg', message);
  res.redirect(redirectPath);
}

function errorRedirect(req, res, message, redirectPath) {
  req.flash('error_msg', message);
  res.redirect(redirectPath);
}

module.exports = {
  successRedirect,
  errorRedirect
};
```

**Usage in Routes**:
```javascript
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');

// Success case
router.post('/tickets', async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(req.body, req.session.user.id);
    successRedirect(req, res, 'Ticket created successfully', `/admin/tickets/${ticket.id}`);
  } catch (error) {
    next(error);
  }
});

// Error case with graceful handling
router.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);

    if (!ticket) {
      return errorRedirect(req, res, 'Ticket not found', '/admin/dashboard');
    }

    res.render('admin/ticket-detail', { ticket });
  } catch (error) {
    next(error);
  }
});
```

**Flash Message Display** (views/partials/flash.ejs):
```ejs
<% if (success_msg && success_msg.length > 0) { %>
  <div class="alert alert-success">
    <%= success_msg %>
  </div>
<% } %>

<% if (error_msg && error_msg.length > 0) { %>
  <div class="alert alert-danger">
    <%= error_msg %>
  </div>
<% } %>
```

**Benefits of this pattern**:
- Consistent UX across all routes
- Centralized flash message handling
- Clean separation of concerns
- Easy to modify message styling globally

---

## Validation Patterns (KNII Implementation)

### express-validator Chains (from validators/)

**Ticket Validation** (validators/ticketValidators.js):
```javascript
const { body, param } = require('express-validator');
const { TICKET_STATUS, TICKET_PRIORITY } = require('../constants/enums');
const { VALIDATION_MESSAGES } = require('../constants/messages');

const validateTicketCreate = [
  body('title')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.TICKET.TITLE_REQUIRED)
    .isLength({ min: 3, max: 200 }).withMessage(VALIDATION_MESSAGES.TICKET.TITLE_LENGTH),

  body('description')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.TICKET.DESCRIPTION_REQUIRED)
    .isLength({ max: 5000 }).withMessage(VALIDATION_MESSAGES.TICKET.DESCRIPTION_LENGTH),

  body('priority')
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(VALIDATION_MESSAGES.TICKET.INVALID_PRIORITY),

  body('assigned_to')
    .optional({ nullable: true })
    .isInt().withMessage('Assigned user must be a valid ID')
];

const validateTicketUpdate = [
  param('id')
    .isInt().withMessage('Invalid ticket ID'),

  body('status')
    .optional()
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(VALIDATION_MESSAGES.TICKET.INVALID_STATUS),

  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(VALIDATION_MESSAGES.TICKET.INVALID_PRIORITY)
];

module.exports = {
  validateTicketCreate,
  validateTicketUpdate
};
```

**User Validation** (validators/userValidators.js):
```javascript
const { body } = require('express-validator');
const User = require('../models/User');
const { USER_ROLE } = require('../constants/enums');
const passwordValidator = require('../utils/passwordValidator');

const validateUserCreate = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
    .custom(async (value) => {
      const existingUser = await User.findByUsername(value);
      if (existingUser) {
        throw new Error('Username already exists');
      }
      return true;
    }),

  body('email')
    .trim()
    .isEmail().withMessage('Must be a valid email')
    .normalizeEmail()
    .custom(async (value) => {
      const existingUser = await User.findByEmail(value);
      if (existingUser) {
        throw new Error('Email already exists');
      }
      return true;
    }),

  body('password')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),

  body('role')
    .isIn(Object.values(USER_ROLE))
    .withMessage('Invalid user role')
];

module.exports = { validateUserCreate };
```

**Authentication Validation** (validators/authValidators.js):
```javascript
const { body } = require('express-validator');

const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required'),

  body('password')
    .notEmpty().withMessage('Password is required')
];

module.exports = { validateLogin };
```

### Validation Middleware (middleware/validation.js)

**Execute validation chains and return errors**:
```javascript
const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    req.flash('error_msg', errorMessages.join(', '));

    // Redirect back to form with errors
    return res.redirect('back');
  }

  next();
}

module.exports = { validateRequest };
```

### Password Validation Utility (utils/passwordValidator.js)

**Complex password validation logic**:
```javascript
const VALIDATION_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true
};

function validate(password) {
  const errors = [];

  if (!password || password.length < VALIDATION_RULES.MIN_LENGTH) {
    errors.push(`Password must be at least ${VALIDATION_RULES.MIN_LENGTH} characters`);
  }

  if (password && password.length > VALIDATION_RULES.MAX_LENGTH) {
    errors.push(`Password cannot exceed ${VALIDATION_RULES.MAX_LENGTH} characters`);
  }

  if (VALIDATION_RULES.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (VALIDATION_RULES.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (VALIDATION_RULES.REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (VALIDATION_RULES.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = { validate, VALIDATION_RULES };
```

### Usage Pattern in Routes

```javascript
// routes/users.js
const { validateUserCreate } = require('../validators/userValidators');
const { validateRequest } = require('../middleware/validation');

router.post('/users',
  requireAuth,
  requireAdmin,
  validateUserCreate,    // Run validation chains
  validateRequest,       // Check results and flash errors
  async (req, res, next) => {
    try {
      await userService.createUser(req.body, req.session.user.id);
      successRedirect(req, res, 'User created successfully', '/admin/users');
    } catch (error) {
      next(error);
    }
  }
);
```

---

## Constants and Enums (KNII Pattern)

### Centralized Constants (constants/)

**Enums for Status and Roles** (constants/enums.js):
```javascript
const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed'
};

const TICKET_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin'
};

module.exports = {
  TICKET_STATUS,
  TICKET_PRIORITY,
  USER_ROLE
};
```

**Flash Message Keys** (constants/messages.js):
```javascript
const FLASH_KEYS = {
  SUCCESS: 'success_msg',
  ERROR: 'error_msg'
};

const AUTH_MESSAGES = {
  LOGIN_REQUIRED: 'Please log in to access this page',
  INVALID_CREDENTIALS: 'Invalid username or password',
  PERMISSION_DENIED: 'You do not have permission to access this page'
};

const TICKET_MESSAGES = {
  CREATED: 'Ticket created successfully',
  UPDATED: 'Ticket updated successfully',
  DELETED: 'Ticket deleted successfully',
  NOT_FOUND: 'Ticket not found'
};

module.exports = {
  FLASH_KEYS,
  AUTH_MESSAGES,
  TICKET_MESSAGES
};
```

**Validation Constants** (constants/validation.js):
```javascript
const VALIDATION_MESSAGES = {
  TICKET: {
    TITLE_REQUIRED: 'Ticket title is required',
    TITLE_LENGTH: 'Title must be between 3 and 200 characters',
    DESCRIPTION_REQUIRED: 'Ticket description is required',
    DESCRIPTION_LENGTH: 'Description cannot exceed 5000 characters',
    INVALID_STATUS: 'Invalid ticket status',
    INVALID_PRIORITY: 'Invalid ticket priority'
  },
  USER: {
    USERNAME_REQUIRED: 'Username is required',
    EMAIL_INVALID: 'Must be a valid email address'
  }
};

const MAX_LENGTHS = {
  TICKET_TITLE: 200,
  TICKET_DESCRIPTION: 5000,
  COMMENT_CONTENT: 2000,
  PHONE_NUMBER: 20,
  USERNAME: 50,
  EMAIL: 100,
  NAME: 100
};

module.exports = {
  VALIDATION_MESSAGES,
  MAX_LENGTHS
};
```

**Usage Pattern**:
```javascript
const { TICKET_STATUS, TICKET_PRIORITY } = require('../constants/enums');
const { TICKET_MESSAGES } = require('../constants/messages');
const { successRedirect } = require('../utils/responseHelpers');

// Use enums for type safety
const ticket = await Ticket.create({
  title: 'Bug report',
  status: TICKET_STATUS.OPEN,  // Not magic string
  priority: TICKET_PRIORITY.HIGH
});

// Use message constants for consistency
successRedirect(req, res, TICKET_MESSAGES.CREATED, `/admin/tickets/${ticket.id}`);
```

**Benefits**:
- Single source of truth for all constants
- Easy to update values globally
- Type safety through autocomplete
- Prevents typos in magic strings
- Makes code more maintainable

---

## Migration Best Practices

### Migration Rules (IMMUTABLE)

**NEVER**:
- Modify existing migration files after deployment
- Delete migration files
- Change migration order
- Skip migrations

**ALWAYS**:
- Create new migrations for changes
- Number migrations sequentially (001, 002, 003...)
- Test migrations on fresh database
- Include rollback strategy
- Document breaking changes

**Example migration**:
```sql
-- migrations/007_add_user_avatar.sql

-- Add new column
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255);

-- Add index if needed
CREATE INDEX idx_users_avatar ON users(avatar_url) WHERE avatar_url IS NOT NULL;

-- Add constraints
ALTER TABLE users ADD CONSTRAINT chk_avatar_url_length
  CHECK (length(avatar_url) <= 255);
```

---

## Docker Configuration (KNII Setup)

### Docker Compose Setup (docker-compose.yml)

**Production-ready container orchestration**:
```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    container_name: ticketing_db
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    build: .
    container_name: ticketing_web
    environment:
      NODE_ENV: ${NODE_ENV}
      PORT: ${PORT}
      DB_HOST: db
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      DB_PORT: 5432
      SESSION_SECRET: ${SESSION_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
```

### Dockerfile Best Practices

**Multi-stage build for production**:
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["node", "index.js"]
```

### Docker Entrypoint Script (scripts/docker-entrypoint.sh)

**Initialize database on startup**:
```bash
#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q'; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready!"

echo "Running database migrations..."
npm run init-db

echo "Starting application..."
exec "$@"
```

### Environment Configuration (.env.example)

**Template for required environment variables**:
```bash
# Environment
NODE_ENV=development

# Server
PORT=3000

# Database
DB_HOST=db
DB_USER=ticketing_user
DB_PASSWORD=changeme_secure_password
DB_NAME=ticketing_db
DB_PORT=5432

# Session (MUST be 32+ characters in production)
SESSION_SECRET=changeme_minimum_32_characters_required

# Logging
LOG_LEVEL=info
```

### Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f web

# Run migrations
docker-compose exec web npm run init-db

# Access database
docker-compose exec db psql -U ticketing_user -d ticketing_db

# Rebuild containers
docker-compose up -d --build

# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Production Deployment Checklist

**Before deploying to production**:
- [ ] Set NODE_ENV=production in environment
- [ ] Use strong SESSION_SECRET (minimum 32 random characters)
- [ ] Use strong database passwords
- [ ] Enable HTTPS/TLS (set cookie.secure=true)
- [ ] Configure proper CORS if needed
- [ ] Set up log rotation
- [ ] Configure database backups
- [ ] Test migrations on staging environment
- [ ] Review and update rate limits
- [ ] Enable database connection pooling limits
- [ ] Configure health checks
- [ ] Set up monitoring and alerts
- [ ] Remove development dependencies
- [ ] Review error messages (no sensitive data)

---

## Anti-Patterns to Avoid

### 1. Callback Hell
```javascript
// BAD
db.query('SELECT * FROM users', (err, users) => {
  db.query('SELECT * FROM tickets', (err, tickets) => {
    db.query('SELECT * FROM comments', (err, comments) => {
      // Nested callbacks
    });
  });
});

// GOOD
const users = await db.query('SELECT * FROM users');
const tickets = await db.query('SELECT * FROM tickets');
const comments = await db.query('SELECT * FROM comments');
```

### 2. Mixing Concerns
```javascript
// BAD - Business logic in routes
router.post('/users', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const user = await pool.query('INSERT INTO users...');
  await pool.query('INSERT INTO audit_logs...');
  res.json(user);
});

// GOOD - Delegate to service
router.post('/users', validateUserCreate, validateRequest, async (req, res, next) => {
  try {
    await userService.createUser(req.body);
    successRedirect(req, res, 'User created', '/admin/users');
  } catch (error) {
    next(error);
  }
});
```

### 3. Ignoring Error Handling
```javascript
// BAD
router.get('/tickets/:id', async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  res.render('ticket', { ticket });
});

// GOOD
router.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return errorRedirect(req, res, 'Not found', '/admin/dashboard');
    }
    res.render('ticket', { ticket });
  } catch (error) {
    logger.error('Error fetching ticket', { error: error.message });
    next(error);
  }
});
```

### 4. Synchronous Operations
```javascript
// BAD
const fs = require('fs');
const data = fs.readFileSync('./file.txt');  // Blocks event loop

// GOOD
const fs = require('fs').promises;
const data = await fs.readFile('./file.txt');
```

### 5. Not Using Constants
```javascript
// BAD
if (user.role === 'super_admin') { }

// GOOD
const { USER_ROLE } = require('../constants/enums');
if (user.role === USER_ROLE.SUPER_ADMIN) { }
```

### 6. Trusting Client Data
```javascript
// BAD
const userId = req.body.userId;  // Client controls this
await User.delete(userId);       // Could delete any user

// GOOD
const userId = req.session.user.id;  // Server controls this
await User.delete(userId);
```

---

## Common Troubleshooting

### Database Connection Issues

**Issue**: `ECONNREFUSED` or `Connection timeout`
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:
```bash
# 1. Check if PostgreSQL is running
docker-compose ps

# 2. Check database logs
docker-compose logs db

# 3. Verify connection parameters in .env
DB_HOST=db  # Use 'db' for Docker, 'localhost' for local
DB_PORT=5432

# 4. Restart containers
docker-compose restart db web
```

---

### Session Store Errors

**Issue**: `relation "session" does not exist`

**Solution**: Run migrations to create session table
```bash
# Run all migrations including session table creation
docker-compose exec web npm run init-db

# Or manually create session table
docker-compose exec db psql -U ticketing_user -d ticketing_db -f migrations/002_create_sessions_table.sql
```

---

### Migration Errors

**Issue**: Migrations run out of order or fail

**Solutions**:
```bash
# 1. Check which migrations have run
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT * FROM schema_migrations ORDER BY version;"

# 2. Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
docker-compose exec web npm run init-db

# 3. Run specific migration manually
docker-compose exec db psql -U ticketing_user -d ticketing_db -f migrations/003_create_tickets.sql
```

---

### Flash Messages Not Displaying

**Issue**: Flash messages set but not appearing in views

**Checklist**:
```javascript
// 1. Verify connect-flash is configured in app.js
const flash = require('connect-flash');
app.use(flash());

// 2. Verify flash middleware passes to res.locals
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// 3. Verify flash partial is included in layout
<!-- views/layout.ejs -->
<%- include('partials/flash') %>

// 4. Verify flash is called before redirect
req.flash('success_msg', 'Message here');
res.redirect('/path');
```

---

### Validation Not Working

**Issue**: Invalid data getting through to service layer

**Checklist**:
```javascript
// 1. Verify validation chain is imported
const { validateTicketCreate } = require('../validators/ticketValidators');

// 2. Verify validateRequest middleware is applied
router.post('/tickets',
  requireAuth,
  validateTicketCreate,    // ✓ Validation chain
  validateRequest,         // ✓ Required to check results
  async (req, res, next) => { ... }
);

// 3. Check validation chain syntax
body('title')
  .trim()
  .notEmpty().withMessage('Title is required')
  .isLength({ max: 200 }).withMessage('Title too long');
```

---

### Authentication Issues

**Issue**: Users logged out unexpectedly or sessions not persisting

**Solutions**:
```javascript
// 1. Check session secret is set (minimum 32 chars)
SESSION_SECRET=your_minimum_32_character_secret_here

// 2. Verify session store is configured
const sessionConfig = {
  store: new pgSession({ pool, tableName: 'session' }),
  // ...
};

// 3. Check cookie settings in production
cookie: {
  secure: process.env.NODE_ENV === 'production',  // HTTPS required
  sameSite: 'strict'
}

// 4. Clear browser cookies and try again

// 5. Check session table in database
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "SELECT * FROM session;"
```

---

### Docker Build Failures

**Issue**: Docker build fails or containers won't start

**Solutions**:
```bash
# 1. Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 2. Remove old containers and images
docker system prune -a

# 3. Check disk space
df -h

# 4. View detailed build logs
docker-compose build web 2>&1 | tee build.log

# 5. Check .dockerignore doesn't exclude necessary files
```

---

### Performance Issues

**Issue**: Slow queries or high memory usage

**Solutions**:
```sql
-- 1. Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM tickets WHERE status = 'open';

-- 2. Add indexes for frequently queried columns
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);

-- 3. Check for N+1 queries - use SQL joins instead
-- BAD: Query in loop
for (const ticket of tickets) {
  const user = await User.findById(ticket.assigned_to);  // N queries!
}

-- GOOD: Single JOIN query
SELECT t.*, u.username
FROM tickets t
LEFT JOIN users u ON t.assigned_to = u.id;
```

```javascript
// 4. Monitor memory usage
docker stats ticketing_web

// 5. Check for memory leaks
const v8 = require('v8');
console.log(v8.getHeapStatistics());
```

---

### Port Already in Use

**Issue**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
```bash
# 1. Find process using port
lsof -i :3000
# or
netstat -vanp tcp | grep 3000

# 2. Kill the process
kill -9 <PID>

# 3. Change port in docker-compose.yml
ports:
  - "3001:3000"  # External:Internal

# 4. Change port in .env
PORT=3001
```

---

### Environment Variables Not Loading

**Issue**: `process.env.VARIABLE` is undefined

**Checklist**:
```bash
# 1. Verify .env file exists at project root
ls -la .env

# 2. Check .env is not in .gitignore (it should be!)
cat .gitignore | grep .env

# 3. Verify dotenv is loaded in app.js
require('dotenv').config();

# 4. Restart containers after .env changes
docker-compose restart web

# 5. Verify variables are set
docker-compose exec web printenv | grep DB_
```

---

## Testing Considerations

See `docs/testing_rules.md` for comprehensive testing guidelines.

**Quick Reference**:
- Unit tests for services, models, utilities
- Integration tests for routes with database
- E2E tests for complete workflows
- Mock external dependencies
- Use test database with transactions

---

## Default Behavior

If instructions are ambiguous:

1. Choose the path that maximizes security
2. Prefer explicit over implicit
3. Favor maintainability over cleverness
4. Follow existing patterns in the codebase
5. Ask for clarification only when business requirements are unclear

---

## Code Review Checklist (KNII Standards)

Before committing code, verify:

**Error Handling & Async**:
- [ ] All async operations have try-catch blocks
- [ ] Catch blocks use `next(error)` to pass to error handler
- [ ] No unhandled promise rejections
- [ ] No synchronous I/O operations in production code

**Security**:
- [ ] Database queries use parameterized statements ($1, $2, etc.)
- [ ] Input validation present using express-validator chains
- [ ] validateRequest middleware applied after validation chains
- [ ] No sensitive data in logs (passwords, tokens, etc.)
- [ ] No sensitive data in API responses
- [ ] Authentication middleware (requireAuth) applied to protected routes
- [ ] Authorization middleware (requireAdmin) applied where needed
- [ ] CSRF protection on state-changing operations
- [ ] Rate limiting on authentication endpoints
- [ ] Session data is minimal (id, username, email, role only)

**Architecture**:
- [ ] Routes call services (not models directly)
- [ ] Services call models (proper separation of concerns)
- [ ] Business logic in services (not routes or models)
- [ ] Models are static classes with no instances
- [ ] Constants used instead of magic strings
- [ ] Response helpers used (successRedirect/errorRedirect)
- [ ] Code follows project structure (correct directory)

**Configuration**:
- [ ] Environment variables used for configuration
- [ ] No hardcoded secrets or credentials
- [ ] No console.log statements (use proper logging if needed)

**Validation & Messages**:
- [ ] Validators applied to all user input routes
- [ ] Validation messages from constants (VALIDATION_MESSAGES)
- [ ] Flash messages from constants (not hardcoded strings)
- [ ] Enums used for status/priority/role values

**Database**:
- [ ] Migrations numbered sequentially
- [ ] No modifications to existing migrations
- [ ] Dynamic queries built safely with parameterized values
- [ ] Database connections properly managed (using pool)

**Production Readiness**:
- [ ] Error messages appropriate for production
- [ ] Logging includes appropriate context
- [ ] No debugging code or commented code
- [ ] Dependencies are up to date
- [ ] No unused imports or variables

---

## Summary: Core Principles

Remember these non-negotiable principles for every line of code:

**Security First**:
- ✓ Always use parameterized queries ($1, $2...)
- ✓ Validate ALL user input with express-validator
- ✓ Never log passwords, tokens, or secrets
- ✓ Use environment variables for configuration

**Architecture**:
- ✓ Routes → Services → Models (never skip layers)
- ✓ Business logic belongs in services
- ✓ Models are data access only (static methods)
- ✓ Use constants instead of magic strings

**Error Handling**:
- ✓ Every async operation needs try-catch
- ✓ Always use next(error) in catch blocks
- ✓ Let the global error handler manage responses

**Code Quality**:
- ✓ Follow the established project structure
- ✓ Use TypeScript-like consistency (enums, interfaces via constants)
- ✓ Write self-documenting code with clear naming
- ✓ Test before committing

**Production Readiness**:
- ✓ Review the deployment checklist before shipping
- ✓ Verify all environment variables are set
- ✓ Run migrations on staging first
- ✓ Monitor logs after deployment

---

Your success is measured by the **security**, **reliability**, **maintainability**, and **performance** of the code you produce.

These rules exist to ensure professional-grade Node.js development. When in doubt, choose the path that maximizes security and follows existing patterns.

**Document Version**: 2.0
**Last Updated**: December 2025
**For**: KNII Ticketing System

---

*For questions or clarifications about these rules, review the specific section or consult the [Common Troubleshooting](#common-troubleshooting) guide.*
