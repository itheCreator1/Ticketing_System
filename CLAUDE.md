# CLAUDE.md - Project Context for AI Assistants

## Project Overview

KNII Ticketing System - A professional support ticket management application with department-based submission and dual-portal architecture (client portal for departments, admin portal for support staff).

**Stack**: Node.js 20, Express 5.x, PostgreSQL 16, EJS templates, Docker
**Production**: PM2 cluster mode
**No ORM**: Raw SQL with pg driver
**Code Quality**: 98% compliance with professional Node.js development standards
**Security**: Zero SQL injection vulnerabilities, multi-layer defense with ownership verification
**Testing**: 345+ test cases passing - 17 unit test files, 6 integration tests, 3 E2E tests
**Version**: v2.1.0 (Department Accounts Feature)

---

## Documentation Index

This file provides a quick reference for AI assistants. For comprehensive documentation:

- **[Node.js Development Rules](docs/node_js.md)** - Comprehensive development standards (2,465 lines)
  - Architecture patterns, security best practices, code organization
  - Error handling, validation, database practices
  - Troubleshooting guide and code review checklist
- **[Debugging & Troubleshooting Rules](docs/debug_rules.md)** - Comprehensive debugging guide (4,087 lines)
  - Winston/Morgan logging infrastructure, error handling flow
  - Development and production debugging workflows
  - Security debugging, performance optimization, common issues
  - Command reference for Docker, PostgreSQL, PM2
- **[Git Workflow Rules](docs/git_rules.md)** - Branch strategy and commit standards
- **[Testing Guidelines](docs/testing_rules.md)** - Testing patterns and practices
- **[Testing Implementation Summary](docs/testing_implementation_summary.md)** - Complete test coverage details
- **[Unit Testing Guide](docs/unit_testing_guide.md)** - Unit testing best practices

---

## Testing Infrastructure (v2.1.0)

**345+ Test Cases Passing** - Professional-grade testing infrastructure

### Test Statistics
- **Total Test Files**: 26 (Unit: 17, Integration: 6, E2E: 3)
- **Test Cases**: 345+ passing
- **Test Code**: 10,000+ lines (extensive unit, integration, and E2E coverage)
- **Coverage**: Core functionality fully tested, department accounts workflows validated
- **Test Execution**: Transaction-based isolation, no side effects

### Test Categories

**Unit Tests** (17 files) - Isolated component testing:
- Models: User.test.js, Ticket.test.js, Comment.test.js, AuditLog.test.js
- Services: authService.test.js, userService.test.js, ticketService.test.js
- Validators: authValidators.test.js, userValidators.test.js, ticketValidators.test.js, commentValidators.test.js
- Middleware: auth.test.js, validation.test.js, errorHandler.test.js, rateLimiter.test.js
- Utils: passwordValidator.test.js, responseHelpers.test.js

**Integration Tests** (6 files) - Component interaction testing:
- Routes: auth.test.js, public.test.js, admin.test.js, users.test.js
- Middleware: auth.test.js (with real DB), validation.test.js (CSRF protection)

**E2E Tests** (3 files) - Complete workflow validation:
- authentication.test.js - Account locking, session management, multi-user scenarios
- ticketLifecycle.test.js - Full ticket journey from submission to closure
- userManagement.test.js - Complete user lifecycle with session clearing

### Test Helpers & Infrastructure
```
tests/
├── unit/              # 17 files - Isolated component tests
├── integration/       # 6 files - Component interaction tests
├── e2e/              # 3 files - Complete workflow tests
├── helpers/          # Test utilities (4 files)
│   ├── database.js   # Transaction management & rollback
│   ├── factories.js  # Dynamic test data generation
│   ├── mocks.js      # Mock objects (req, res, pool, logger)
│   └── assertions.js # Custom matchers (toBeValidUser, toBeValidTicket, etc.)
├── fixtures/         # Static test data (3 files: users, tickets, comments)
└── setup.js          # Global test configuration
```

### Running Tests
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Patterns Used
- **AAA Pattern**: Arrange-Act-Assert in all tests
- **Transaction Isolation**: Each test runs in isolated transaction with automatic rollback
- **Factory Pattern**: Dynamic test data generation to avoid conflicts
- **Mock Objects**: Complete isolation for unit tests
- **Supertest**: HTTP integration testing
- **Custom Matchers**: Domain-specific assertions (toBeValidUser, toBeValidTicket, etc.)

---

## Architecture

```
Request Flow:
Routes → Validators → Middleware → Services → Models → Database Pool

Directory Structure:
├── config/           # Database pool, session config
├── constants/        # Enums, messages, validation strings
├── middleware/       # Auth guards, error handler, validation runner
├── migrations/       # SQL files (run in order, never modify after deploy)
├── models/           # Static class methods for DB operations
├── routes/           # Express routers
├── services/         # Business logic layer
├── utils/            # Helper functions
├── validators/       # express-validator chains
└── views/            # EJS templates
```

---

## Department Accounts Feature (v2.1.0)

**Dual-Portal Architecture**: The system now features separate portals for department users and administrators.

### Key Features

**Client Portal** (`/client/*` routes):
- Department users create and manage their own tickets
- View only tickets created by their department
- Add public comments to their tickets
- Update ticket status (waiting_on_admin, closed)
- Auto-populated department and reporter information

**Admin Portal** (`/admin/*` routes):
- View and manage all tickets (department + legacy)
- Add public or internal comments (visibility control)
- Assign tickets to support staff
- Full status workflow management
- User management (super_admin only)

### Department User Management

**Creating Department Users**:
1. Navigate to Admin → User Management (super_admin only)
2. Create user with:
   - Role: `department`
   - Department: Required (IT Support, General Support, HR, Finance, Facilities)
   - Username, email, password
3. Department users automatically redirect to `/client/dashboard` on login

**Department Roles**:
- **Department**: Access to client portal only, can only see/manage their own tickets
- **Admin**: Access to admin portal, can manage all tickets
- **Super Admin**: Full access including user management

### Workflow States

**Ticket Status Flow**:
- `open` → Initial state when ticket created
- `in_progress` → Admin actively working on ticket
- `waiting_on_admin` → Department waiting for admin response
- `waiting_on_department` → Admin waiting for department response
- `closed` → Ticket resolved

**Comment Visibility**:
- `public` - Visible to both admin and department users
- `internal` - Admin-only notes (department users never see these)

### Security Model

**Ownership Verification**:
- Every client route verifies `ticket.reporter_id === session.user.id`
- SQL-level filtering prevents unauthorized access
- Department users cannot access other departments' tickets

**Comment Filtering**:
- Database-level filtering: `WHERE visibility_type = 'public'` for department users
- Admins see all comments (public + internal)
- No way for department users to see internal comments

**Authentication Flow**:
```javascript
Login → Role Check → Redirect
  - department → /client/dashboard
  - admin/super_admin → /admin/dashboard
```

### Auto-Population Logic

When department users create tickets:
- `reporter_id` = current user ID (for ownership)
- `reporter_department` = user's department field
- `priority` = forced to 'unset' (admins set priority)
- `status` = 'open' (initial state)

---

## Database Schema

```sql
departments (id, name, description, is_system, active, created_at, updated_at)
  - name: VARCHAR(100) UNIQUE - Department name (e.g., 'IT Support', 'Finance')
  - is_system: BOOLEAN - True for 'Internal' (admin-only), cannot be edited/deleted
  - active: BOOLEAN - Soft deletion flag (false = deactivated)

users (id, username, email, password_hash, role, department → departments.name, status, login_attempts, last_login_at, password_changed_at, deleted_at, created_at, updated_at)
  - role: 'admin' | 'super_admin' | 'department'
  - department: Foreign key to departments.name (required for department role, null for admin roles)
  - status: 'active' | 'inactive' | 'deleted'

tickets (id, title, description, status, priority, reporter_name, reporter_department → departments.name, reporter_phone, reporter_id → users.id, assigned_to → users.id, created_at, updated_at)
  - status: 'open' | 'in_progress' | 'closed' | 'waiting_on_admin' | 'waiting_on_department'
  - priority: 'unset' | 'low' | 'medium' | 'high' | 'critical' (default: 'unset')
  - reporter_department: Foreign key to departments.name
  - reporter_id: Links to department user account (NULL for legacy anonymous tickets)

comments (id, ticket_id → tickets.id, user_id → users.id, content, visibility_type, created_at)
  - visibility_type: 'public' | 'internal' (default: 'public')

audit_logs (id, actor_id → users.id, action, target_type, target_id, details JSONB, ip_address, created_at)

session (sid, sess JSON, expire)  -- managed by connect-pg-simple
```

**Foreign Key Constraints**:
- `users.department` → `departments.name` (ON UPDATE CASCADE, ON DELETE RESTRICT)
- `tickets.reporter_department` → `departments.name` (ON UPDATE CASCADE, ON DELETE RESTRICT)
- `tickets.assigned_to` → `users.id` (SET NULL on delete)
- `tickets.reporter_id` → `users.id` (SET NULL on delete)
- `comments.ticket_id` → `tickets.id` (CASCADE on delete)
- `comments.user_id` → `users.id` (CASCADE on delete)
- `audit_logs.actor_id` → `users.id` (no cascade)

---

## Authentication & Authorization

**Session-based auth** using express-session + connect-pg-simple.

**Middleware chain** (defined in middleware/auth.js):
```javascript
requireAuth       // Checks req.session.user exists, verifies user still active
requireAdmin      // Checks role is 'admin' or 'super_admin' (excludes department)
requireSuperAdmin // Checks role is 'super_admin' only
requireDepartment // Checks role is 'department' only
```

**Route protection**:
- `/admin/*` routes use `requireAuth` + `requireAdmin`
- `/admin/users/*` routes use `requireAuth` + `requireSuperAdmin`
- `/client/*` routes use `requireAuth` + `requireDepartment`

**Security features**:
- Account locks after 5 failed login attempts (login_attempts field)
- Passwords hashed with bcryptjs (cost 10)
- Session cookie: httpOnly, secure in production, sameSite strict
- CSRF protection on all state-changing requests (POST/PUT/DELETE)
- Rate limiting on login endpoint (10 attempts per 15 minutes per IP)
- Rate limiting on public ticket submission (5 attempts per hour per IP)
- Input length limits on all text fields to prevent DoS attacks
- Timing attack prevention: dummy hash comparison for non-existent users
- User enumeration prevention: generic error messages for all login failures
- Session invalidation: automatic logout when user is deactivated or deleted
- Ticket ID parameter validation to prevent SQL errors and injection attempts

**CSRF Protection**: Using csrf-csrf (double-submit cookie pattern)
- All POST/PUT/DELETE requests require CSRF token
- Token generated per-request via `res.locals.csrfToken`
- Must be included in forms as hidden field: `<input type="hidden" name="_csrf" value="<%= csrfToken %>">`
- Automatically validated by doubleCsrfProtection middleware
- Cookie name: `__Host-psifi.x-csrf-token`
- Ignored methods: GET, HEAD, OPTIONS

---

## Critical Patterns

### 1. Database Queries
Always use parameterized queries. Never concatenate strings.
```javascript
// CORRECT
const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

// WRONG - SQL injection vulnerability
const result = await pool.query(`SELECT * FROM users WHERE id = ${id}`);
```

### 2. Flash Messages
Use constants and helpers:
```javascript
const { FLASH_KEYS } = require('../constants/messages');
const { successRedirect, errorRedirect } = require('../utils/responseHelpers');

// Usage
successRedirect(req, res, 'User created', '/admin/users');
errorRedirect(req, res, 'Failed to create user', '/admin/users/new');
```

### 3. Validators
Validators are arrays of express-validator middleware. Always pair with validateRequest:
```javascript
const { validateUserCreate } = require('../validators/userValidators');
const { validateRequest } = require('../middleware/validation');

router.post('/', validateUserCreate, validateRequest, async (req, res) => {
  // req.body is now validated
});
```

**Validator patterns**:
- `validateTicketId` - Validates ticket ID parameters (positive integer)
- `validateTicketAssignment` - Validates assigned_to field (null or valid user ID)
- Length validation using `MAX_LENGTHS` constants
- Custom async validators use Model methods (e.g., `User.findByEmail()`) NOT direct pool access

**Example with length validation**:
```javascript
body('title')
  .trim()
  .isLength({ min: 1, max: MAX_LENGTHS.TICKET_TITLE })
  .withMessage(VALIDATION_MESSAGES.TITLE_TOO_LONG)
```

### 4. Models
Static class methods, not instantiated. Return raw rows:
```javascript
// CORRECT
const user = await User.findById(id);

// Models return result.rows[0] for single, result.rows for multiple
```

**User model security pattern**:
- `findById(id)` - Returns user WITHOUT password_hash (safe)
- `findByUsername(username)` - Returns user WITHOUT password_hash (safe)
- `findByUsernameWithPassword(username)` - Returns ALL fields including password_hash (auth-only)
- `findByEmail(email)` - Returns user WITHOUT password_hash (safe)
- `clearUserSessions(userId)` - Removes all active sessions for a user (used when deactivated/deleted)

**CRITICAL**: Never return password_hash from public model methods. Only `*WithPassword` methods should include it.

**Department model pattern** (added in v2.3.0):
- `findAll(includeSystem)` - Returns active departments (includeSystem=true includes 'Internal')
- `findAllForAdmin()` - Returns all departments including inactive (for management UI)
- `findById(id)` - Returns department by ID
- `findByName(name)` - Returns department by name
- `create({ name, description })` - Creates new department (is_system=false, active=true)
- `update(id, { name, description, active })` - Updates non-system departments only
- `deactivate(id)` - Soft deletes non-system departments (sets active=false)
- `countUsers(name)` - Counts users assigned to department (for safety checks)
- `countTickets(name)` - Counts tickets in department (for safety checks)

**Protection**: System departments (is_system=true) cannot be updated or deactivated.

### 5. Services
Business logic lives here. Services call models, handle validation logic:
```javascript
// Services throw errors for business rule violations
async deleteUser(actorId, targetId, ipAddress) {
  if (actorId === targetId) {
    throw new Error('Cannot delete yourself');
  }
  // ...
}
```

**Session invalidation pattern**:
```javascript
// In userService.updateUser() - clears sessions when status changes to non-active
if (status && status !== 'active' && status !== targetUser.status) {
  await User.clearUserSessions(targetId);
}

// In userService.deleteUser() - clears sessions after soft delete
await User.clearUserSessions(targetId);
```

**Security benefit**: Deactivated or deleted users are immediately logged out from all devices, preventing unauthorized access after account status changes.

### 6. Error Handling
- Routes wrap async code in try/catch, call next(error)
- Global error handler in middleware/errorHandler.js
- Production hides error details, development shows them
- **Pattern**: All errors delegated to centralized error handler (no errorRedirect in routes)

**Consistent pattern**:
```javascript
router.post('/:id', async (req, res, next) => {
  try {
    // Route logic
    successRedirect(req, res, 'Success message', '/redirect/path');
  } catch (error) {
    logger.error('Error description', { error: error.message, stack: error.stack });
    next(error); // Pass to global error handler
  }
});
```

### 7. Rate Limiting
Rate limiting is implemented using express-rate-limit middleware in `middleware/rateLimiter.js`.

**loginLimiter**:
- Limits: 10 attempts per 15 minutes per IP
- Applied to: `/auth/login` endpoint
- Prevents: Brute force password attacks
- On limit exceeded: Redirects to login with flash message

**ticketSubmissionLimiter**:
- Limits: 5 submissions per hour per IP
- Applied to: `/submit-ticket` public endpoint
- Prevents: Spam and abuse of public submission form

Usage:
```javascript
const { loginLimiter } = require('../middleware/rateLimiter');
router.post('/login', loginLimiter, validateLogin, validateRequest, async (req, res) => {
  // ...
});
```

### 8. Logging
Structured logging using Winston in `utils/logger.js`.

**Usage**:
```javascript
const logger = require('../utils/logger');

logger.info('User logged in', { userId: user.id, username: user.username });
logger.error('Database error', { error: err.message, stack: err.stack });
logger.warn('Rate limit exceeded', { ip: req.ip });
```

**Log levels**: error, warn, info, debug
**Production**: Logs to files and console
**Development**: Console only with colorized output

### 9. Input Length Validation
All text inputs have maximum length constraints to prevent DoS attacks and database bloat.

**MAX_LENGTHS constants** (defined in `constants/validation.js`):
```javascript
const MAX_LENGTHS = {
  TICKET_TITLE: 200,
  TICKET_DESCRIPTION: 5000,
  COMMENT_CONTENT: 2000,
  PHONE_NUMBER: 20,
  USERNAME: 50,
  EMAIL: 100,
  NAME: 100
};
```

**Usage in validators**:
```javascript
body('title')
  .trim()
  .isLength({ min: 1, max: MAX_LENGTHS.TICKET_TITLE })
  .withMessage(VALIDATION_MESSAGES.TITLE_TOO_LONG)
```

**Rationale**: Prevents malicious users from submitting extremely large payloads that could consume server resources or cause database issues.

### 10. parseUserId Middleware
Reusable middleware to parse and validate user IDs from route parameters.

**Location**: `middleware/validation.js`

**Usage**:
```javascript
const { parseUserId } = require('../middleware/validation');

router.get('/:id/edit', parseUserId, async (req, res) => {
  const userId = req.userId; // Already parsed and validated
  // ...
});
```

**Behavior**:
- Parses `req.params.id` to integer
- Validates it's a positive number (> 0)
- Attaches parsed value to `req.userId`
- Returns 400 error for invalid IDs

**Benefit**: Eliminates parseInt() duplication across routes and ensures consistent validation.

---

## File Dependency Map

```
index.js
├── config/session.js → config/database.js
├── middleware/errorHandler.js
├── middleware/rateLimiter.js → express-rate-limit
├── utils/logger.js → winston (logging library)
├── routes/public.js → validators, services, models
├── routes/auth.js → validators, services, models, AuditLog
├── routes/admin.js → middleware/auth, validators, services, models
└── routes/users.js → middleware/auth, validators, services, models

services/userService.js → models/User, models/AuditLog, utils/passwordValidator, models/User.clearUserSessions
services/authService.js → models/User, models/User.findByUsernameWithPassword
services/ticketService.js → models/Ticket, models/User

validators/* → models/User.findByEmail, constants/validation (MAX_LENGTHS)
validators/shared/passwordRules.js → utils/passwordValidator

models/* → config/database.js (pool)
```

---

## Common Tasks

### Add a new route
1. Create validator in `/validators/` if needed
2. Add route in appropriate `/routes/` file
3. Add service method in `/services/` if business logic needed
4. Add model method in `/models/` if new DB operation needed
5. Create view in `/views/` if HTML response

### Add a database column
1. Create new migration file: `migrations/009_description.sql` (increment number)
2. Use `ALTER TABLE ... ADD COLUMN`
3. Update relevant model to use new column
4. Never modify existing migration files

**Current migration number**: 013 (last: add_user_department_column)

### Add a new model method
```javascript
// In models/SomeModel.js
static async newMethod(params) {
  const result = await pool.query(
    'SELECT ... FROM ... WHERE ... = $1',
    [params]
  );
  return result.rows; // or result.rows[0] for single
}
```

### Add audit logging
```javascript
await AuditLog.create({
  actorId: req.session.user.id,
  action: 'ACTION_NAME',
  targetType: 'user|ticket|comment',
  targetId: targetId,
  details: { key: 'value' },
  ipAddress: req.ip
});
```

### Add input validation with length limits
```javascript
// 1. Import MAX_LENGTHS and VALIDATION_MESSAGES
const { MAX_LENGTHS, VALIDATION_MESSAGES } = require('../constants/validation');

// 2. Add validation chain in validator file
body('fieldName')
  .trim()
  .isLength({ min: 1, max: MAX_LENGTHS.FIELD_NAME })
  .withMessage(VALIDATION_MESSAGES.FIELD_TOO_LONG)
```

---

## Testing Changes Locally

```bash
# Full rebuild (clears data)
docker-compose down -v
docker-compose up --build

# Restart without data loss
docker-compose restart web

# View logs
docker-compose logs -f web

# Access database
docker-compose exec db psql -U ticketing_user -d ticketing_db

# Check if tables exist
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "\dt"
```

**Default admin credentials**: admin / admin123

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| SESSION_SECRET | Yes | Min 32 chars for session encryption |
| NODE_ENV | Yes | 'development' or 'production' |
| PORT | No | Default 3000 |
| POSTGRES_USER | Docker | Database username |
| POSTGRES_PASSWORD | Docker | Database password |
| POSTGRES_DB | Docker | Database name |
| DB_PORT | Docker | Database port (default: 5432) |
| DOCKER_COMMAND | No | Docker deployment command (default: docker-compose) |
| RESTART_POLICY | No | PM2 restart policy (default: 'cluster') |
| LOG_LEVEL | No | Winston log level: error, warn, info, debug (default: 'info') |

---

## Do Not

1. **Modify existing migration files** - Create new ones instead
2. **Use string concatenation in SQL** - Always parameterized queries
3. **Skip validators on routes** - Security vulnerability
4. **Call models directly from routes** - Use services for business logic
5. **Store sensitive data in session** - Only id, username, email, role
6. **Change session cookie settings** - Breaks existing sessions
7. **Remove requireAuth from admin routes** - Security vulnerability
8. **Use synchronous bcrypt methods** - Use async versions
9. **Forget to handle errors in async routes** - Wrap in try/catch
10. **Return password_hash from User model public methods** - Security risk

---

## Constants Reference

### User Roles (constants/enums.js)
```javascript
USER_ROLE.ADMIN = 'admin'
USER_ROLE.SUPER_ADMIN = 'super_admin'
```

### User Status
```javascript
USER_STATUS.ACTIVE = 'active'
USER_STATUS.INACTIVE = 'inactive'
USER_STATUS.DELETED = 'deleted'
```

### Ticket Status
```javascript
TICKET_STATUS.OPEN = 'open'
TICKET_STATUS.IN_PROGRESS = 'in_progress'
TICKET_STATUS.CLOSED = 'closed'
```

### Ticket Priority
```javascript
TICKET_PRIORITY.UNSET = 'unset'
TICKET_PRIORITY.LOW = 'low'
TICKET_PRIORITY.MEDIUM = 'medium'
TICKET_PRIORITY.HIGH = 'high'
TICKET_PRIORITY.CRITICAL = 'critical'
```

### Reporter Department (constants/enums.js)
**⚠️ DEPRECATED**: This constant is kept for backward compatibility only. Departments are now database-driven. Use `Department.findAll()` instead.

```javascript
REPORTER_DEPARTMENT.IT_SUPPORT = 'IT Support'
REPORTER_DEPARTMENT.GENERAL_SUPPORT = 'General Support'
REPORTER_DEPARTMENT.HUMAN_RESOURCES = 'Human Resources'
REPORTER_DEPARTMENT.FINANCE = 'Finance'
REPORTER_DEPARTMENT.FACILITIES = 'Facilities'
REPORTER_DEPARTMENT.INTERNAL = 'Internal'  // System department (admin-only, added in v2.2.0)
```

**New Approach (v2.3.0+)**: Use the Department model to fetch departments dynamically:
```javascript
// Get all active non-system departments (for user dropdowns)
const departments = await Department.findAll(false);

// Get all departments including system (for admin ticket forms)
const allDepartments = await Department.findAll(true);
```

### Validation Messages (constants/validation.js)
```javascript
VALIDATION_MESSAGES.USERNAME_INVALID
VALIDATION_MESSAGES.EMAIL_INVALID
VALIDATION_MESSAGES.EMAIL_IN_USE
VALIDATION_MESSAGES.PASSWORD_REQUIRED
VALIDATION_MESSAGES.PASSWORD_TOO_SHORT
VALIDATION_MESSAGES.PASSWORD_COMPLEXITY
VALIDATION_MESSAGES.TITLE_REQUIRED
VALIDATION_MESSAGES.DESCRIPTION_REQUIRED
// ... and more
```

All validation error messages use these constants for consistency.

### Input Length Limits (constants/validation.js)
```javascript
MAX_LENGTHS.TICKET_TITLE = 200
MAX_LENGTHS.TICKET_DESCRIPTION = 5000
MAX_LENGTHS.COMMENT_CONTENT = 2000
MAX_LENGTHS.PHONE_NUMBER = 20
MAX_LENGTHS.USERNAME = 50
MAX_LENGTHS.EMAIL = 100
MAX_LENGTHS.NAME = 100
MAX_LENGTHS.DEPARTMENT = 100
MAX_LENGTHS.DESK = 100
```

Used in validators to prevent DoS attacks via large payloads.

### Message Constants (constants/messages.js)
```javascript
AUTH_MESSAGES = { LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT_SUCCESS, UNAUTHORIZED, FORBIDDEN, SUPER_ADMIN_REQUIRED }
TICKET_MESSAGES = { CREATED, UPDATED, NOT_FOUND, LOAD_FAILED, etc. }
COMMENT_MESSAGES = { CREATED, DELETED, etc. }
USER_MESSAGES = { CREATED, UPDATED, DELETED, PASSWORD_RESET, STATUS_UPDATED, etc. }
```

---

## Views Structure

```
views/
├── admin/
│   ├── dashboard.ejs      # Ticket list with filters
│   ├── ticket-detail.ejs  # Single ticket view/edit
│   └── users/
│       ├── index.ejs      # User list (super_admin only)
│       ├── create.ejs     # New user form
│       └── edit.ejs       # Edit user + password reset
├── auth/
│   └── login.ejs          # Login form
├── errors/
│   ├── 404.ejs
│   └── 500.ejs
├── partials/
│   ├── header.ejs         # Nav bar with conditional user management link
│   ├── footer.ejs
│   └── flash.ejs          # Flash message display
└── public/
    ├── submit-ticket.ejs  # Public ticket form
    └── success.ejs        # Submission confirmation
```

**Template variables available globally** (set in index.js middleware):
- `success_msg` - Array of success flash messages
- `error_msg` - Array of error flash messages
- `user` - Session user object or null
- `csrfToken` - CSRF token for form submissions (required for POST/PUT/DELETE)

**CSRF token usage in forms**:
```ejs
<form method="POST" action="/some/endpoint">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <!-- form fields -->
</form>
```

---

## Git Workflow

Follow rules in `docs/git_rules.md`:
- Never commit directly to main
- Use feature branches: `feature/`, `fix/`, `refactor/`, `chore/`
- Atomic commits with clear messages
- All changes via Pull Requests

---

## Comprehensive Development Standards

For detailed Node.js development standards, architecture patterns, security best practices, and troubleshooting:

📘 **See [docs/node_js.md](docs/node_js.md)** - Complete Node.js Development Rules (Version 2.0)

This comprehensive guide includes:
- ✅ **26 detailed sections** covering all aspects of Node.js development
- ✅ **Quick reference templates** for routes, services, and models
- ✅ **Security best practices** with code examples
- ✅ **Performance patterns** and optimization techniques
- ✅ **Troubleshooting guide** for common issues
- ✅ **Code review checklist** with 30+ verification points
- ✅ **Production deployment** checklist

**Current Compliance**: 97% (Excellent) - Based on comprehensive audit of 23 core files

---

## Quick Fixes for Common Issues

### Account locked
```sql
UPDATE users SET login_attempts = 0 WHERE username = 'USERNAME';
```

### User not showing in management
```sql
-- Check if soft-deleted
SELECT * FROM users WHERE status = 'deleted';
```

### Session issues
```bash
# Clear all sessions
docker-compose exec db psql -U ticketing_user -d ticketing_db -c "TRUNCATE session;"
```

### Database not initialized
```bash
docker-compose exec web node scripts/init-db.js
```