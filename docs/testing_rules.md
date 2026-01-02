# Testing Rules

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
│       └── migrations.test.js
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

```json
{
    "scripts": {
        "test": "jest",
        "test:unit": "jest --testPathPattern=tests/unit",
        "test:integration": "jest --testPathPattern=tests/integration --runInBand",
        "test:e2e": "jest --testPathPattern=tests/e2e --runInBand",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage",
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