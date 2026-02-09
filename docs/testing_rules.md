# Testing Rules - KNII Ticketing System

**Version:** 2.4.0
**Last Updated:** February 2026
**Target Project:** KNII Ticketing System (Node.js 20 + Express 5 + PostgreSQL 16)

---

You are Claude Code operating inside a development environment with full access to the local repository and testing infrastructure.

Your primary responsibility is to ensure that this project uses testing as a first-class engineering discipline, not merely as a checkbox for coverage metrics.

You MUST actively design, implement, and maintain tests that serve as living documentation, regression safeguards, and architectural guides throughout the entire lifecycle of the project.

---

## Global Testing Principles (Mandatory)

1. Treat the test suite as production-grade code deserving the same care as application code.
2. Never write tests that are tightly coupled to implementation details.
3. Prefer small, focused, single-responsibility test cases.
4. Every test must have:
   - A clear intent expressed in its name
   - Predictable and deterministic behavior
   - Independence from other tests (no shared mutable state)
5. The test suite must tell a coherent story of the system's expected behavior.

---

## Test Statistics (v2.4.0)

**Current Status**: 945 passing out of 945 total tests (100% pass rate)

### Test Suite Breakdown

| Category | Passing | Total | Pass Rate | Status |
|----------|---------|-------|-----------|--------|
| Unit Tests | 416 | 416 | 100% | ✅ Excellent |
| Database Tests | 112 | 112 | 100% | ✅ Excellent |
| Integration/E2E | 417 | 417 | 100% | ✅ Excellent |
| **Total** | **945** | **945** | **100%** | ✅ Excellent |

### Test Categories

**Unit Tests** (17 files, 416 tests):
- Models: User, Ticket, Comment, AuditLog, Department, Floor
- Services: Auth, User, Ticket, Client Ticket
- Validators: Auth, User, Ticket, Comment
- Middleware: Auth, Validation, Error Handler, Rate Limiter
- Utils: Password Validator, Response Helpers, Search Sanitization

**Database/Migration Tests** (4 files, 112 tests):
- Schema Integrity (40 tests) - Table structure, columns, constraints
- Foreign Key Behavior (15 tests) - CASCADE, RESTRICT, SET NULL behaviors
- Data Migration (16 tests) - Migration 012, 015, 020 validation
- Migration Runner (41 tests) - All 25 migrations execute correctly

**Integration Tests** (10 files, 417 passing):
- Routes: Auth, Public, Admin, Users, Client, Floors
- Middleware: Auth (with DB), Validation (CSRF)
- Seeder: Hospital data seeding validation

**E2E Tests** (3 files, all passing):
- Authentication workflow
- Ticket lifecycle
- User management

### Recent Improvements (v2.3.0)

1. **Test Infrastructure Fixes** ✅
   - Floor seeding in test setup (fixes FK violations)
   - Database cleanup order fix (DELETE not TRUNCATE)
   - Schema helper SQL fixes (ambiguous column references)
   - Global pool cleanup (prevents Jest hanging)

2. **Pass Rate Improvement** ✅
   - v2.2.0: 73% (690/945 tests passing)
   - v2.3.0: 84.3% (797/945 tests passing)
   - v2.4.0: 100% (945/945 tests passing)

3. **Zero FK Violations** ✅
   - All unit tests: 100% passing
   - All database tests: 100% passing
   - Floor seeding ensures departments have valid floor references

### Coverage Status

**Test Coverage**: ~70-80% across critical paths
- **Thresholds**: 60% minimum (branches, functions, lines, statements)
- **Enforcement**: Jest configuration enforces thresholds on every run
- **Reports**: `npm run test:coverage` generates HTML reports

**Coverage by Layer**:
- Models: High coverage (CRUD operations, FK handling)
- Services: Good coverage (business logic paths)
- Routes: Moderate coverage (happy paths covered)
- Middleware: High coverage (auth, validation, rate limiting)
- Utils: Excellent coverage (all helpers tested)

### Running Tests

```bash
# Run all tests
npm test

# Run by category
npm run test:unit          # Unit tests only (416 tests)
npm run test:integration   # Integration + E2E + Database (529 tests)

# Run with coverage
npm run test:coverage      # Enforces 60% threshold
npm run test:coverage:html # Opens HTML report

# Run specific test file
npm test -- tests/unit/models/User.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create user"

# Watch mode for development
npm run test:watch
```

---

## Test Organization Strategy

Structure tests to mirror the application architecture while maintaining clear separation of concerns.

```
tests/
├── unit/                    # Isolated component tests
│   ├── models/
│   │   ├── User.test.js
│   │   ├── Ticket.test.js
│   │   ├── Comment.test.js
│   │   └── AuditLog.test.js
│   ├── services/
│   │   ├── authService.test.js
│   │   ├── ticketService.test.js
│   │   └── userService.test.js
│   ├── utils/
│   │   ├── passwordValidator.test.js
│   │   └── responseHelpers.test.js
│   └── validators/
│       ├── authValidators.test.js
│       ├── ticketValidators.test.js
│       └── userValidators.test.js
├── integration/             # Component interaction tests
│   ├── routes/
│   │   ├── auth.test.js
│   │   ├── admin.test.js
│   │   ├── public.test.js
│   │   └── users.test.js
│   ├── middleware/
│   │   ├── auth.test.js
│   │   └── validation.test.js
│   └── database/
│       ├── schemaIntegrity.test.js
│       ├── foreignKeyBehavior.test.js
│       ├── dataMigration.test.js
│       └── migrationRunner.test.js
├── e2e/                     # End-to-end workflow tests
│   ├── ticketLifecycle.test.js
│   ├── userManagement.test.js
│   └── authentication.test.js
├── fixtures/                # Reusable test data
│   ├── users.js
│   ├── tickets.js
│   └── comments.js
├── helpers/                 # Shared test utilities
│   ├── database.js          # DB setup/teardown
│   ├── auth.js              # Authentication helpers
│   ├── factories.js         # Data factories
│   └── assertions.js        # Custom assertions
└── setup.js                 # Global test configuration
```

### Directory Responsibilities

- `unit/`: Test individual functions and methods in complete isolation. Mock all external dependencies.
- `integration/`: Test how components work together. Use real database connections with test transactions.
- `e2e/`: Test complete user workflows from HTTP request to database and back.
- `fixtures/`: Store static test data that represents valid domain objects.
- `helpers/`: Extract reusable test logic to avoid duplication.

---

## Test Naming Conventions

Test names must describe behavior, not implementation.

### File Naming

```
<ComponentName>.test.js      # Unit tests
<feature>.test.js            # Integration/E2E tests
```

### Test Case Naming

Use the pattern: `should <expected behavior> when <condition>`

```javascript
// Good
describe('AuthService', () => {
    describe('authenticate', () => {
        it('should return user object when credentials are valid', async () => {})
        it('should return null when password is incorrect', async () => {})
        it('should increment login attempts when authentication fails', async () => {})
        it('should throw error when account is locked', async () => {})
        it('should reset login attempts when authentication succeeds', async () => {})
    })
})

// Bad
describe('AuthService', () => {
    it('test authenticate', async () => {})
    it('works correctly', async () => {})
    it('handles error', async () => {})
})
```

### Describe Block Structure

```javascript
describe('<ComponentName>', () => {
    describe('<methodName>', () => {
        describe('when <context>', () => {
            it('should <behavior>', () => {})
        })
    })
})
```

---

## Test Writing Discipline

### The AAA Pattern (Arrange-Act-Assert)

Every test must follow this structure with clear visual separation:

```javascript
it('should create ticket with valid data', async () => {
    // Arrange
    const ticketData = {
        title: 'Test Issue',
        description: 'Detailed description',
        reporter_name: 'John Doe',
        reporter_email: 'john@example.com',
        priority: 'medium'
    }

    // Act
    const result = await ticketService.createTicket(ticketData)

    // Assert
    expect(result).toBeDefined()
    expect(result.id).toBeGreaterThan(0)
    expect(result.title).toBe(ticketData.title)
    expect(result.status).toBe('open')
})
```

### One Assertion Concept Per Test

Each test should verify one logical concept, though multiple `expect` statements may be needed to verify that concept:

```javascript
// Good: One concept (user creation) with related assertions
it('should create user with hashed password and default values', async () => {
    const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
    })

    expect(user.id).toBeDefined()
    expect(user.password_hash).not.toBe('Password123!')
    expect(user.role).toBe('admin')
    expect(user.status).toBe('active')
})

// Bad: Multiple unrelated concepts
it('should handle user operations', async () => {
    const user = await User.create({...})
    expect(user.id).toBeDefined()
    
    const found = await User.findById(user.id)
    expect(found.username).toBe(user.username)
    
    await User.softDelete(user.id)
    const deleted = await User.findById(user.id)
    expect(deleted).toBeNull()
})
```

### Test Data Management

Use factories for dynamic test data, fixtures for static reference data:

```javascript
// helpers/factories.js
const createUserData = (overrides = {}) => ({
    username: `user_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'ValidPass123!',
    role: 'admin',
    ...overrides
})

const createTicketData = (overrides = {}) => ({
    title: 'Test Ticket',
    description: 'Test description',
    reporter_name: 'Test Reporter',
    reporter_email: 'reporter@example.com',
    priority: 'medium',
    ...overrides
})

module.exports = { createUserData, createTicketData }
```

```javascript
// Usage in tests
const { createUserData, createTicketData } = require('../helpers/factories')

it('should create ticket', async () => {
    const ticketData = createTicketData({ priority: 'high' })
    const result = await ticketService.createTicket(ticketData)
    expect(result.priority).toBe('high')
})
```

---

## Modularization Guidelines

### Extract Common Setup

```javascript
// helpers/database.js
const pool = require('../../config/database')

const setupTestDatabase = async () => {
    await pool.query('BEGIN')
}

const teardownTestDatabase = async () => {
    await pool.query('ROLLBACK')
}

const cleanTable = async (tableName) => {
    await pool.query(`DELETE FROM ${tableName}`)
}

module.exports = { setupTestDatabase, teardownTestDatabase, cleanTable }
```

### Create Domain-Specific Helpers

```javascript
// helpers/auth.js
const createAuthenticatedSession = async (app, userOverrides = {}) => {
    const userData = createUserData(userOverrides)
    const user = await User.create(userData)
    
    const agent = request.agent(app)
    await agent
        .post('/auth/login')
        .send({ username: userData.username, password: userData.password })
    
    return { agent, user }
}

const createSuperAdminSession = async (app) => {
    return createAuthenticatedSession(app, { role: 'super_admin' })
}

module.exports = { createAuthenticatedSession, createSuperAdminSession }
```

### Isolate External Dependencies

```javascript
// helpers/mocks.js
const createMockPool = () => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
})

const createMockRequest = (overrides = {}) => ({
    session: {},
    flash: jest.fn(),
    body: {},
    params: {},
    query: {},
    ip: '127.0.0.1',
    ...overrides
})

const createMockResponse = () => {
    const res = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    res.render = jest.fn().mockReturnValue(res)
    res.redirect = jest.fn().mockReturnValue(res)
    res.locals = {}
    return res
}

module.exports = { createMockPool, createMockRequest, createMockResponse }
```

---

## Test Categories and When to Use Them

### Unit Tests

- Test pure functions and methods in isolation
- Mock all external dependencies (database, services, HTTP)
- Fast execution (milliseconds)
- High volume (majority of test suite)

```javascript
// unit/utils/passwordValidator.test.js
const { validatePassword, getPasswordStrength } = require('../../utils/passwordValidator')

describe('passwordValidator', () => {
    describe('validatePassword', () => {
        it('should reject passwords shorter than 8 characters', () => {
            const result = validatePassword('Short1!')
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain('Password must be at least 8 characters long')
        })

        it('should accept passwords meeting all requirements', () => {
            const result = validatePassword('ValidPass123!')
            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })
    })
})
```

### Integration Tests

- Test component interactions with real dependencies
- Use test database with transaction rollback
- Medium execution time (seconds)
- Focus on boundaries and contracts

```javascript
// integration/routes/auth.test.js
const request = require('supertest')
const app = require('../../index')
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/database')
const { createUserData } = require('../helpers/factories')

describe('Auth Routes', () => {
    beforeEach(setupTestDatabase)
    afterEach(teardownTestDatabase)

    describe('POST /auth/login', () => {
        it('should redirect to dashboard on successful login', async () => {
            const userData = createUserData()
            await User.create(userData)

            const response = await request(app)
                .post('/auth/login')
                .send({ username: userData.username, password: userData.password })

            expect(response.status).toBe(302)
            expect(response.headers.location).toBe('/admin/dashboard')
        })

        it('should increment login attempts on failed login', async () => {
            const userData = createUserData()
            const user = await User.create(userData)

            await request(app)
                .post('/auth/login')
                .send({ username: userData.username, password: 'wrongpassword' })

            const updatedUser = await User.findByUsername(userData.username)
            expect(updatedUser.login_attempts).toBe(1)
        })
    })
})
```

### End-to-End Tests

- Test complete user workflows
- Use real browser or HTTP client
- Slower execution (tens of seconds)
- Limited quantity (critical paths only)

```javascript
// e2e/ticketLifecycle.test.js
describe('Ticket Lifecycle', () => {
    it('should complete full ticket workflow from submission to closure', async () => {
        // Submit ticket as public user
        const ticketResponse = await request(app)
            .post('/submit-ticket')
            .send(createTicketData())
        
        const ticketId = extractTicketId(ticketResponse)

        // Login as admin
        const { agent } = await createAuthenticatedSession(app)

        // View ticket
        const viewResponse = await agent.get(`/admin/tickets/${ticketId}`)
        expect(viewResponse.status).toBe(200)

        // Update status to in_progress
        await agent
            .post(`/admin/tickets/${ticketId}/update`)
            .send({ status: 'in_progress' })

        // Add comment
        await agent
            .post(`/admin/tickets/${ticketId}/comments`)
            .send({ content: 'Working on this' })

        // Close ticket
        await agent
            .post(`/admin/tickets/${ticketId}/update`)
            .send({ status: 'closed' })

        // Verify final state
        const ticket = await Ticket.findById(ticketId)
        expect(ticket.status).toBe('closed')
    })
})
```

---

## Expandability Patterns

### Plugin Architecture for Test Utilities

```javascript
// helpers/assertions.js
expect.extend({
    toBeValidTicket(received) {
        const pass = received.id !== undefined &&
            received.title !== undefined &&
            received.status !== undefined &&
            ['open', 'in_progress', 'closed'].includes(received.status)

        return {
            message: () => `expected ${JSON.stringify(received)} to be a valid ticket`,
            pass
        }
    },

    toBeActiveUser(received) {
        const pass = received.id !== undefined &&
            received.status === 'active' &&
            received.username !== undefined

        return {
            message: () => `expected ${JSON.stringify(received)} to be an active user`,
            pass
        }
    }
})
```

### Parameterized Tests for Exhaustive Coverage

```javascript
describe('Ticket Priority Validation', () => {
    const validPriorities = ['low', 'medium', 'high', 'critical']
    const invalidPriorities = ['urgent', 'normal', '', null, undefined, 123]

    validPriorities.forEach(priority => {
        it(`should accept priority: ${priority}`, async () => {
            const ticketData = createTicketData({ priority })
            const result = await ticketService.createTicket(ticketData)
            expect(result.priority).toBe(priority)
        })
    })

    invalidPriorities.forEach(priority => {
        it(`should reject priority: ${JSON.stringify(priority)}`, async () => {
            const ticketData = createTicketData({ priority })
            await expect(ticketService.createTicket(ticketData))
                .rejects.toThrow()
        })
    })
})
```

### Test Configuration for Different Environments

```javascript
// setup.js
const config = {
    database: {
        test: {
            connectionString: process.env.TEST_DATABASE_URL,
            max: 5
        }
    },
    timeout: {
        unit: 5000,
        integration: 15000,
        e2e: 30000
    }
}

module.exports = config
```

---

## Maintainability Practices

### Keep Tests DRY Without Sacrificing Readability

Extract common setup but keep assertions explicit:

```javascript
// Good: Shared setup, explicit assertions
describe('User Service', () => {
    let testUser

    beforeEach(async () => {
        testUser = await User.create(createUserData())
    })

    it('should find user by id', async () => {
        const found = await userService.getUserById(testUser.id)
        expect(found.username).toBe(testUser.username)
    })

    it('should update user email', async () => {
        const newEmail = 'updated@example.com'
        await userService.updateUser(testUser.id, testUser.id, { email: newEmail }, '127.0.0.1')
        
        const updated = await User.findById(testUser.id)
        expect(updated.email).toBe(newEmail)
    })
})
```

### Document Complex Test Scenarios

```javascript
/**
 * Tests the account locking mechanism after consecutive failed login attempts.
 * 
 * Business Rule: After 5 failed attempts, account is locked and subsequent
 * login attempts should fail even with correct credentials until an admin
 * resets the login_attempts counter.
 */
describe('Account Locking', () => {
    it('should lock account after 5 failed attempts', async () => {
        // ... implementation
    })
})
```

### Version Test Data Schemas

```javascript
// fixtures/schemas.js
const SCHEMA_VERSION = '1.0.0'

const userSchemaV1 = {
    username: 'string',
    email: 'string',
    password: 'string',
    role: ['admin', 'super_admin']
}

module.exports = { SCHEMA_VERSION, userSchemaV1 }
```

---

## Automation and CI Integration

### Test Scripts Configuration

**MANDATORY**: All test scripts MUST include `--runInBand` to prevent cross-suite database contamination. Without it, Jest runs suites in parallel, and since integration/E2E tests share the same PostgreSQL database, parallel execution causes phantom failures due to race conditions and shared mutable state.

```json
{
    "scripts": {
        "test": "jest --runInBand",
        "test:unit": "jest --testPathPattern=tests/unit --runInBand",
        "test:integration": "jest --testPathPattern=tests/integration --runInBand",
        "test:e2e": "jest --testPathPattern=tests/e2e --runInBand",
        "test:watch": "jest --watch --runInBand",
        "test:coverage": "jest --coverage --runInBand",
        "test:ci": "jest --ci --coverage --runInBand"
    }
}
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'models/**/*.js',
        'services/**/*.js',
        'routes/**/*.js',
        'middleware/**/*.js',
        'utils/**/*.js',
        'validators/**/*.js',
        '!**/node_modules/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    testTimeout: 10000,
    verbose: true
}
```

### Pre-Commit Hook Integration

```bash
# .husky/pre-commit
npm run test:unit
```

### CI Pipeline Requirements

- All unit tests must pass before merge
- Integration tests run on PR creation
- E2E tests run before deployment
- Coverage reports generated and tracked
- Flaky tests flagged and fixed within 24 hours

---

## Test Infrastructure (v2.4.0)

The test infrastructure ensures reliable, isolated test execution with proper database handling.

### Test Setup Functions

**Location**: `tests/helpers/database.js`

#### setupTestDatabase() - Unit Test Setup

Used by unit tests that need database access with transaction isolation.

```javascript
// tests/unit/models/User.test.js
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');

describe('User Model', () => {
  beforeEach(async () => {
    await setupTestDatabase();  // Begin transaction + seed floors/departments
  });

  afterEach(async () => {
    await teardownTestDatabase();  // Rollback transaction
  });

  it('should create user', async () => {
    // Test runs in isolated transaction
  });
});
```

**What it does**:
1. Acquires dedicated client from pool
2. Begins transaction (`BEGIN`)
3. **Seeds 8 floors** (Basement, Ground Floor, 1st-6th Floor) - v2.3.0
4. **Seeds test departments** with floor references - v2.3.0
5. All changes isolated to this transaction

#### setupIntegrationTest() - Integration Test Setup

Used by integration/E2E tests that make HTTP requests.

```javascript
// tests/integration/routes/admin.test.js
const { setupIntegrationTest, teardownIntegrationTest } = require('../../helpers/database');

describe('Admin Routes', () => {
  beforeEach(async () => {
    await setupIntegrationTest();  // Seed floors + departments
  });

  afterEach(async () => {
    await teardownIntegrationTest();  // Clean all tables
  });

  it('should require authentication', async () => {
    // Test makes actual HTTP requests
  });
});
```

**What it does**:
1. **Seeds 8 floors** (required for department FK) - v2.3.0
2. **Seeds test departments** (Emergency, Cardiology, etc.) - v2.3.0
3. Uses `ON CONFLICT DO NOTHING` for idempotency
4. No transactions (HTTP tests need committed data)

### Database Cleanup (v2.3.0)

**Critical Fix**: Cleanup order respects FK dependencies.

#### cleanAllTables()

```javascript
async function cleanAllTables() {
  // Delete in reverse dependency order
  await pool.query('DELETE FROM comments');      // 1. Child of tickets
  await pool.query('DELETE FROM tickets');       // 2. Child of departments, users
  await pool.query('DELETE FROM audit_logs');    // 3. References users
  await pool.query('DELETE FROM session');       // 4. Independent table
  await pool.query('DELETE FROM users');         // 5. Child of departments
  await pool.query('DELETE FROM departments');   // 6. Child of floors
  await pool.query('DELETE FROM floors');        // 7. Parent of departments
}
```

**Why This Order**:
- Must delete children before parents (FK constraints)
- `TRUNCATE CASCADE` removed in v2.3.0 (caused audit_logs FK violations)
- Individual `DELETE` statements respect FK relationships

### Floor Seeding (v2.3.0 Fix)

**Problem Solved**: After Migration 024 removed hardcoded floors, tests failed with:
```
error: insert or update on table "departments" violates foreign key constraint "fk_departments_floor"
```

**Solution**: Both test setup functions now seed 8 floors BEFORE departments:

```javascript
const testFloors = [
  { name: 'Basement', sort_order: 0 },
  { name: 'Ground Floor', sort_order: 1 },
  { name: '1st Floor', sort_order: 2 },
  { name: '2nd Floor', sort_order: 3 },
  { name: '3rd Floor', sort_order: 4 },
  { name: '4th Floor', sort_order: 5 },
  { name: '5th Floor', sort_order: 6 },
  { name: '6th Floor', sort_order: 7 }
];

for (const floor of testFloors) {
  await client.query(
    `INSERT INTO floors (name, sort_order, is_system, active)
     VALUES ($1, $2, false, true)
     ON CONFLICT (name) DO NOTHING`,
    [floor.name, floor.sort_order]
  );
}
```

**Impact**: Eliminated all FK constraint violations in tests.

### Test Isolation Patterns

#### Transaction-Based Isolation (Unit Tests)

```javascript
let testClient = null;  // Dedicated client per test

async function setupTestDatabase() {
  testClient = await pool.connect();  // Get dedicated client
  await testClient.query('BEGIN');    // Start transaction
  // ... seed data
}

async function teardownTestDatabase() {
  if (testClient) {
    await testClient.query('ROLLBACK');  // Undo all changes
    testClient.release();                // Return to pool
    testClient = null;
  }
}
```

**Benefits**:
- Complete isolation between tests
- Automatic cleanup (rollback)
- Fast (no actual deletes needed)
- Prevents connection leaks

#### Pool-Based Cleanup (Integration Tests)

```javascript
async function teardownIntegrationTest() {
  await cleanAllTables();  // Explicit deletion in correct order
}
```

**Why Not Transactions**:
- HTTP requests need committed data
- Supertest can't see uncommitted transactions
- Must use actual DELETE statements

### Global Test Configuration

**File**: `tests/setup.js`

```javascript
// Set test environment
process.env.NODE_ENV = 'test';

// Global teardown
afterAll(async () => {
  await pool.end();  // Close database pool
});
```

**Critical**: Pool cleanup prevents Jest from hanging after test completion.

### Migration Testing

**Files**: `tests/integration/database/`

- `schemaIntegrity.test.js` (40 tests) - Verify table structure
- `foreignKeyBehavior.test.js` (15 tests) - Test FK constraints
- `dataMigration.test.js` (16 tests) - Validate data migrations
- `migrationRunner.test.js` (41 tests) - All 25 migrations run successfully

**Purpose**: Ensure database schema matches expectations after all migrations.

### Test Helpers

**Schema Helpers** (`tests/helpers/schemaHelpers.js`):
```javascript
// Query information_schema to validate database structure
const tables = await getTableNames();
const columns = await getTableColumns('users');
const indexes = await getTableIndexes('tickets');
const fks = await getForeignKeys('departments');
```

**Factories** (`tests/helpers/factories.js`):
```javascript
// Generate unique test data
const userData = createUserData({ username: 'testuser' });
const ticketData = createTicketData({ title: 'Test Ticket' });
```

**Custom Assertions** (`tests/helpers/assertions.js`):
```javascript
expect(user).toBeValidUser();
expect(ticket).toBeValidTicket();
expect(comment).toBeValidComment();
```

### Common Test Issues & Solutions

#### Issue: FK Constraint Violations

**Symptom**:
```
error: insert or update on table "departments" violates foreign key constraint "fk_departments_floor"
```

**Solution**: Ensure test setup seeds floors before departments.

#### Issue: Jest Hangs After Tests

**Symptom**: Jest doesn't exit after test completion.

**Solution**: Add global `afterAll` to close database pool:
```javascript
afterAll(async () => {
  await pool.end();
});
```

#### Issue: Flaky Tests

**Symptom**: Tests pass sometimes, fail other times.

**Common Causes**:
- Shared mutable state between tests
- Missing `await` on async operations
- Race conditions in parallel tests
- Insufficient cleanup between tests

**Solution**: Use proper setup/teardown, avoid shared state.

#### Issue: CSRF Errors in Tests

**Symptom**:
```
Error: Invalid CSRF token
```

**Solution**: CSRF protection is automatically disabled in test environment (`NODE_ENV=test`).

---

## Anti-Patterns to Avoid

### Test Implementation Details

```javascript
// Bad: Testing internal state
it('should set _isAuthenticated flag', () => {
    authService.login(credentials)
    expect(authService._isAuthenticated).toBe(true)
})

// Good: Testing observable behavior
it('should allow access to protected resource after login', async () => {
    await authService.login(credentials)
    const result = await authService.canAccess('/admin/dashboard')
    expect(result).toBe(true)
})
```

### Shared Mutable State

```javascript
// Bad: Tests depend on shared state
let counter = 0
beforeAll(() => { counter = 0 })

it('test 1', () => { counter++; expect(counter).toBe(1) })
it('test 2', () => { counter++; expect(counter).toBe(2) }) // Fragile

// Good: Each test is independent
it('test 1', () => {
    const counter = createCounter()
    counter.increment()
    expect(counter.value).toBe(1)
})
```

### Overly Broad Tests

```javascript
// Bad: Too many concerns
it('should handle user management', async () => {
    // 50 lines of setup and assertions covering create, update, delete
})

// Good: Focused tests
it('should create user with valid data', async () => {})
it('should reject duplicate username', async () => {})
it('should soft delete user', async () => {})
```

### Magic Values

```javascript
// Bad: What does 5 mean?
expect(user.login_attempts).toBe(5)

// Good: Named constants
const MAX_LOGIN_ATTEMPTS = 5
expect(user.login_attempts).toBe(MAX_LOGIN_ATTEMPTS)
```

### Sleeping in Tests

```javascript
// Bad: Arbitrary delay
await new Promise(resolve => setTimeout(resolve, 1000))
expect(result).toBeDefined()

// Good: Wait for specific condition
await waitFor(() => expect(result).toBeDefined())
```

### Ignoring Error Paths

```javascript
// Bad: Only testing happy path
describe('createUser', () => {
    it('should create user', async () => {})
})

// Good: Comprehensive coverage
describe('createUser', () => {
    it('should create user with valid data', async () => {})
    it('should reject missing username', async () => {})
    it('should reject duplicate email', async () => {})
    it('should reject weak password', async () => {})
    it('should reject invalid role', async () => {})
})
```

---

## Default Behavior

If instructions are ambiguous:

1. Choose the path that results in more maintainable tests
2. Prefer explicit over implicit behavior
3. Write tests that fail for the right reasons
4. Ask for clarification only when the business requirement is unclear
5. Default to writing the test first (TDD) for new features

---

## Test Review Checklist

Before committing tests, verify:

- [ ] Test name clearly describes expected behavior
- [ ] Test follows AAA pattern with clear separation
- [ ] Test is independent and can run in isolation
- [ ] Test uses factories/helpers instead of inline test data
- [ ] Test covers both success and failure cases
- [ ] Test does not rely on implementation details
- [ ] Test does not use arbitrary sleeps or delays
- [ ] Test assertions are specific and meaningful
- [ ] Test file is in the correct directory (unit/integration/e2e)
- [ ] No console.log statements left in test code

---

Your success is measured not only by passing tests, but by the clarity, maintainability, and architectural guidance the test suite provides to current and future developers.