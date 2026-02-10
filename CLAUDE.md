# CLAUDE.md - Project Context for AI Assistants

## Project Overview

KNII Ticketing System - A professional support ticket management application with department-based submission and dual-portal architecture (client portal for departments, admin portal for support staff).

**Stack**: Node.js 20, Express 5.x, PostgreSQL 16, EJS templates, Docker, Tailwind CSS
**Production**: PM2 cluster mode
**No ORM**: Raw SQL with pg driver
**Code Quality**: 98% compliance with professional Node.js development standards
**Security**: Zero SQL injection vulnerabilities, multi-layer defense with department-based access control, search input sanitization, admin mutation rate limiting
**Testing**: 945 test cases passing (100%) - 38 test suites with comprehensive unit, integration, and E2E coverage
**CI/CD**: Docker-based testing + ESLint + Prettier + security audit via GitHub Actions
**Version**: 2.4.0 (Professional CI/CD + Docker-Based Testing + Full Lint Compliance)

---

## Documentation Index

This file provides a quick reference for AI assistants. For comprehensive documentation:

- **[Node.js Development Rules](docs/node_js.md)** - Comprehensive development standards (2,900+ lines)
  - Architecture patterns, security best practices, code organization
  - Error handling, validation, database practices
  - Rate limiting patterns (loginLimiter, adminMutationLimiter)
  - Search input sanitization (defense-in-depth)
  - Troubleshooting guide and code review checklist
- **[Debugging & Troubleshooting Rules](docs/debug_rules.md)** - Comprehensive debugging guide (4,087 lines)
  - Winston/Morgan logging infrastructure, error handling flow
  - Development and production debugging workflows
  - Security debugging, performance optimization, common issues
  - Command reference for Docker, PostgreSQL, PM2
- **[Testing Guidelines](docs/testing_rules.md)** - Testing patterns and practices (850+ lines)
  - Test statistics: 945/945 passing (100% pass rate)
  - Test infrastructure documentation (floor seeding, cleanup order)
  - Transaction-based isolation, FK-aware cleanup
  - Migration testing (all 25 migrations validated)
- **[CI/CD Guide](docs/ci-cd.md)** - GitHub Actions workflows and automation - UPDATED v2.4.0
  - Docker-based test execution (matches local dev workflow)
  - Lint workflow (ESLint + Prettier, zero conflicts)
  - Security audit (production deps = hard fail)
  - Coverage report uploaded as artifact
- **[Git Workflow Rules](docs/git_rules.md)** - Branch strategy and commit standards

---

## Testing Infrastructure

**945/945 tests passing (100%)** - 38 test suites (Unit: 23, Integration: 12, E2E: 3). Coverage threshold: 60%. Details in [docs/testing_rules.md](docs/testing_rules.md).

**IMPORTANT**: All tests MUST run inside Docker. Tests require `--runInBand` (sequential) to prevent cross-suite contamination.

```bash
docker-compose exec web npm test              # All tests
docker-compose exec web npm run test:unit      # Unit only
docker-compose exec web npm run test:integration  # Integration + migration
docker-compose exec web npm run test:coverage  # With coverage report
docker-compose exec web npm run test:watch     # Watch mode
docker-compose exec web npx jest tests/unit/models/User.test.js --no-coverage  # Single file
```

**Key infrastructure notes**:
- CSRF protection disabled in test environment (`NODE_ENV=test`)
- FK-aware cleanup order: comments -> tickets -> audit_logs -> session -> users -> departments -> floors
- Floor seeding runs before departments to satisfy FK constraints
- Unit tests use transaction isolation with dedicated client (not `pool.query()`)
- Benchmarks: `npm run bench` (auth, tickets, comments). Details in `docs/performance-baseline.md`

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

## Dual-Portal Architecture

**Client Portal** (`/client/*`): Department users create/manage their own department's tickets, add public comments, update status (waiting_on_admin, closed). Auto-populated reporter info.

**Admin Portal** (`/admin/*`): Manage all tickets, create department tickets on behalf of depts, create internal admin-only tickets, add public/internal comments, assign staff, manage users (super_admin) and departments (super_admin).

### Ticket Creation Types

| Feature | Dept User Ticket | Admin Dept Ticket | Admin Internal Ticket |
|---------|-----------------|-------------------|---------------------|
| Route | `/client/tickets/new` | `/admin/tickets/department/new` | `/admin/tickets/new` |
| Created by | Department user | Admin (on behalf) | Admin |
| Visible to dept | Yes | Yes | No |
| reporter_id | User ID | NULL | Admin ID |
| is_admin_created | false | false | true |
| Priority | 'unset' fixed | Admin sets | Admin sets |

### Security Model
- Client routes verify `ticket.reporter_department === req.session.user.department` (department-based access)
- Internal admin tickets (`is_admin_created=true`) blocked on all client routes
- Comments filtered: department users see only `visibility_type = 'public'`
- Login redirects: department -> `/client/dashboard`, admin/super_admin -> `/admin/dashboard`

---

## Database Schema

```sql
departments (id, name, description, floor, is_system, active, created_at, updated_at)
  - name: VARCHAR(100) UNIQUE - Department name (e.g., 'IT Support', 'Finance')
  - floor: VARCHAR(20) NOT NULL - Physical floor location (Basement, Ground Floor, 1st-6th Floor)
    - Validated by CHECK constraint: floor IN ('Basement', 'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor')
    - Indexed for efficient filtering
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
- **Department-based access control** for client portal (v2.2.0+)

**Session Data** (created by `authService.createSessionData()`):
```javascript
req.session.user = {
  id: user.id,                    // User ID
  username: user.username,        // Username
  email: user.email,              // Email address
  role: user.role,                // 'admin', 'super_admin', or 'department'
  department: user.department     // Department name (required for department users)
}
```

**Department-Based Access Control** (v2.2.0+):
- Client routes verify `ticket.reporter_department === req.session.user.department`
- Allows department users to access both user-created and admin-created department tickets
- Blocks cross-department access (dept users only see their own department's tickets)
- Blocks internal admin tickets (`is_admin_created === true`) with defense-in-depth check
- All client routes (detail, comments, status updates) implement department verification

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

**Department model pattern**:
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

**Ticket model pattern** (v2.2.0+):
- `findByDepartment(department, filters)` - Returns all non-internal tickets for a department (v2.2.0+)
  - Filters by `reporter_department = department` AND `is_admin_created = false`
  - **v2.2.0 change**: Changed from `reporter_id = userId` to `reporter_department = department`
  - This allows department users to see both user-created and admin-created department tickets
  - Parameters: `department` (string: dept name), `filters` (status, priority, search)
  - Used by client portal to fetch department user's tickets
- `findById(id)` - Returns single ticket by ID (includes assigned_to_username)
- `create(ticketData)` - Creates new ticket with all fields
- `update(id, updates)` - Updates ticket fields (status, priority, assigned_to)
- `findByStatus(status)` - Returns all tickets with given status (admin use)

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

**adminMutationLimiter** (new in v2.3.0):
- Limits: 20 requests per minute per IP
- Applied to: Admin mutation endpoints (POST/PUT/DELETE operations)
- Targets: User management, ticket creation/updates, department management
- Prevents: Abuse of admin endpoints, DoS attacks
- On limit exceeded: Redirects back with flash message
- Skipped in test environment for test execution

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

### 10. Search Input Sanitization (new in v2.3.0)
Search inputs are sanitized to prevent SQL injection and improve query security.

**sanitizeSearchInput utility** (defined in `utils/sanitizeSearch.js`):
```javascript
const { sanitizeSearchInput } = require('../utils/sanitizeSearch');

// Sanitizes by:
// 1. Removing SQL wildcards (%, _)
// 2. Escaping backslashes to prevent escape sequences
// 3. Trimming whitespace
// 4. Limiting length to 100 characters
```

**Usage in Ticket model**:
```javascript
if (filters.search) {
  query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
  const sanitizedSearch = sanitizeSearchInput(filters.search);
  params.push(`%${sanitizedSearch}%`);
  paramIndex++;
}
```

**Benefits**:
- Defense-in-depth security (complements parameterized queries)
- Prevents SQL injection through search inputs
- Safe handling of special characters
- 100% unit test coverage

### 11. parseUserId Middleware
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

**Current migration number**: 025 (last: add_composite_indexes)

**Migration 020**: add_department_floor - Added floor column to departments table with CHECK constraint
**Migration 021**: fix_audit_log_fk_constraint - Fixed audit_logs FK to use ON DELETE SET NULL for audit trail preservation
**Migration 022**: create_floors_table - Created floors table for database-driven floor management (replaces hardcoded constants)
**Migration 023**: convert_floor_to_fk - Converted departments.floor from CHECK constraint to foreign key for dynamic floor management
**Migration 024**: remove_hardcoded_system_floors - Removed seeded system floors to make floors fully dynamic and customizable
**Migration 025**: add_composite_indexes - Added composite indexes for 50-80% performance improvement in dashboard queries

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

# Run test suite (MUST be inside container)
docker-compose exec web npm test
```

**Default admin credentials**: admin / (randomly generated at first boot — check Docker logs)

**IMPORTANT**: Always run tests inside the Docker container (`docker-compose exec web npm test`). Never run `npm test` or `npx jest` directly on the host machine - tests require the PostgreSQL database running in the `db` container.

---

## Development Utilities

Floors and departments are configured via JSON files in `config/seed-data/`. See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for details.

```bash
docker-compose exec web npm run seed:hospital              # Seed floors, departments, users from JSON configs
docker-compose exec web npm run seed:hospital -- --clean    # Clean and re-seed
docker-compose exec web npm run seed:sample                 # Seed sample tickets and comments
docker-compose exec web npm run seed:sample -- --clean      # Clean and re-seed sample data
docker-compose exec web node scripts/reset-passwords.js     # Reset all passwords to 'password123'
```

Scripts are for **development/testing only**. Never run in production.

---

## CI/CD and Code Quality

GitHub Actions runs two workflows on push/PR to `main`/`develop`. See [docs/ci-cd.md](docs/ci-cd.md) for details.

**CI Workflow** (`.github/workflows/ci.yml`):
- **Tests (Docker)**: `docker compose -f docker-compose.ci.yml up --build --exit-code-from web` — runs all 945 tests inside Docker with coverage, uploads report as artifact
- **Security Audit**: `npm audit --omit=dev --audit-level=high` — production deps must be clean

**Lint Workflow** (`.github/workflows/lint.yml`):
- **ESLint**: `npm run lint` — 0 errors, 0 warnings required
- **Prettier**: `npm run format:check` — all files must be formatted

```bash
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Run Prettier
npm run format:check   # Check formatting without changes
```

**Style**: 2-space indent, single quotes, semicolons, ES5 trailing commas, 100 char width. Formatting rules handled exclusively by Prettier — do NOT add style rules to `.eslintrc.js`.

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

All constants in `constants/` directory. Key enums (`constants/enums.js`):
- **Roles**: admin, super_admin, department
- **User Status**: active, inactive, deleted
- **Ticket Status**: open, in_progress, closed, waiting_on_admin, waiting_on_department
- **Ticket Priority**: unset, low, medium, high, critical
- **Comment Visibility**: public, internal

Departments are database-driven (not hardcoded). Use `Department.findAll(includeSystem)` to fetch.
Validation messages in `constants/validation.js`, flash messages in `constants/messages.js`.

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
└── partials/
    ├── header.ejs         # Nav bar with conditional user management link
    ├── footer.ejs
    └── flash.ejs          # Flash message display
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

## UI Component System

**Location:** `views/partials/badges/` and `views/partials/forms/`

All components accept optional `size` (sm/md/lg), `cssClass`, and `withIcon` (boolean) params.

**Badge Components** (use via `<%- include('path', { params }) %>`):
- **badge.ejs** - Generic badge. Params: `color` (success/danger/warning/info/secondary/light/dark), `text`
- **status-badge.ejs** - Ticket status. Params: `status`. Colors: open=info, in_progress=warning, waiting_on_admin=info, waiting_on_department=danger, closed=success
- **priority-badge.ejs** - Ticket priority. Params: `priority`. Colors: unset=light, low=secondary, medium=info, high=warning, critical=danger
- **role-badge.ejs** - User role. Params: `role`. Colors: super_admin=danger, admin=primary, department=info

**Form Components**:
- **form-field.ejs** - Input field. Params: `type`, `name`, `label`, `value`, `required`, `placeholder`, `helpText`, `autocomplete`, `disabled`
- **select-field.ejs** - Dropdown. Params: `name`, `label`, `value`, `required`, `options` ([{value, label}]), `helpText`, `disabled`

Test all components at: `http://localhost:3000/test-components`

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