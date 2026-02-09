# CI/CD Guide - KNII Ticketing System
**Version**: 2.4.0
**Last Updated**: February 2026

---

## Table of Contents

1. [Overview](#overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [CI Workflow (Automated Testing)](#ci-workflow-automated-testing)
4. [Lint Workflow (Code Quality)](#lint-workflow-code-quality)
5. [ESLint Configuration](#eslint-configuration)
6. [Prettier Configuration](#prettier-configuration)
7. [Local Pre-Commit Testing](#local-pre-commit-testing)
8. [Troubleshooting CI Failures](#troubleshooting-ci-failures)
9. [Badge Integration](#badge-integration)
10. [Best Practices](#best-practices)

---

## Overview

The KNII Ticketing System uses **GitHub Actions** for continuous integration and continuous deployment (CI/CD). This automation ensures code quality, prevents regressions, and maintains consistent coding standards across the project.

**Key Benefits**:
- ✅ Automated testing on every push and pull request
- ✅ Code quality enforcement (ESLint + Prettier)
- ✅ Security vulnerability scanning (npm audit)
- ✅ Test coverage tracking
- ✅ Docker-based test execution matching local dev workflow

**Workflows**:
1. **CI Workflow** (`.github/workflows/ci.yml`) - Runs tests, generates coverage
2. **Lint Workflow** (`.github/workflows/lint.yml`) - Enforces code quality and formatting

---

## GitHub Actions Workflows

### Workflow Triggers

Both workflows run automatically on:
- **Push** to `main` or `develop` branches
- **Pull requests** targeting `main` or `develop` branches

**Example workflow trigger**:
```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```

### Viewing Workflow Results

1. **On GitHub**: Navigate to `Actions` tab in repository
2. **On Pull Requests**: Check status at bottom of PR page
3. **In README**: Badges show current status (passing/failing)

**Status Badges**:
```markdown
[![CI](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/ci.yml/badge.svg)](...)
[![Lint](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/lint.yml/badge.svg)](...)
```

---

## CI Workflow (Automated Testing)

**File**: `.github/workflows/ci.yml`

### Workflow Jobs

The CI workflow consists of **2 parallel jobs**:

1. **Test Job** - Runs full test suite with PostgreSQL
2. **Security Job** - Scans for npm vulnerabilities

### Test Job Details

**Environment**:
- Uses `docker-compose.ci.yml` to build and run tests inside Docker
- Identical to local development: `docker-compose exec web npm test`
- PostgreSQL 16 Alpine as database service with healthcheck
- Entrypoint script handles DB readiness + migrations automatically

**Steps**:

1. **Checkout Code**
   ```yaml
   - uses: actions/checkout@v4
   ```

2. **Build and Run Tests**
   ```bash
   docker compose -f docker-compose.ci.yml up --build --exit-code-from web --abort-on-container-exit
   ```
   - Runs all 945 test cases with coverage
   - Currently passing: 945/945 (100%)
   - Enforces 60% coverage threshold
   - Fails if tests fail or coverage drops below threshold

3. **Upload Coverage Report**
   - Uploads coverage directory as GitHub artifact (14-day retention)
   - Coverage is bind-mounted to `./coverage` for artifact upload

4. **Clean Up**
   ```bash
   docker compose -f docker-compose.ci.yml down
   ```

**Key Design Decisions**:
- Tests run inside Docker, not on bare runner -- matches local dev exactly
- Single test pass with coverage (not two separate runs)
- Coverage bind-mounted to `./coverage` for artifact upload
- `--exit-code-from web` propagates test exit code to CI

### Security Job Details

**Purpose**: Scan for known npm vulnerabilities

**Steps**:

1. **npm Audit (Production - Hard Fail)**
   ```bash
   npm audit --omit=dev --audit-level=high
   ```
   - Scans production dependencies only
   - Fails CI on high/critical vulnerabilities
   - Must be fixed before merge

2. **npm Audit (All - Informational)**
   ```bash
   npm audit --audit-level=moderate
   ```
   - Scans all dependencies including devDependencies
   - Warns on moderate+ vulnerabilities
   - Continues on error (informational only)

---

## Lint Workflow (Code Quality)

**File**: `.github/workflows/lint.yml`

### Workflow Jobs

The lint workflow consists of **2 parallel jobs**:

1. **ESLint Job** - JavaScript/Node.js linting
2. **Prettier Job** - Code formatting checks

### ESLint Job Details

**Purpose**: Enforce code quality and best practices

**Steps**:

1. **Run ESLint**
   ```bash
   npm run lint
   ```
   - Checks all `.js` files
   - Enforces ESLint rules (see ESLint Configuration)
   - Fails CI on any errors

2. **Annotate Code** (On Failure)
   - Adds inline annotations on PR
   - Shows exact line with linting error
   - Helps developers fix issues quickly

**Common ESLint Errors**:
```javascript
// ERROR: no-unused-vars
const unusedVar = 'value';  // ❌ Remove or prefix with _

// ERROR: prefer-const
let name = 'John';  // ❌ Should be const

// ERROR: no-console (in non-test files)
console.log('Debug');  // ❌ Use logger instead

// ERROR: eqeqeq
if (x == 5) {}  // ❌ Use === instead
```

### Prettier Job Details

**Purpose**: Enforce consistent code formatting

**Steps**:

1. **Check Formatting**
   ```bash
   npm run format:check
   ```
   - Checks all files against Prettier rules
   - Fails CI if any file is not formatted
   - Does NOT auto-format (read-only check)

2. **Comment on PR** (On Failure)
   - Posts comment with fix instructions
   - Example:
     ```
     ❌ **Code formatting check failed!**

     Please run `npm run format` to auto-format your code,
     then commit the changes.
     ```

**How to Fix**:
```bash
# Auto-format all files
npm run format

# Commit the changes
git add .
git commit -m "chore: auto-format code with Prettier"
git push
```

---

## ESLint Configuration

**File**: `.eslintrc.js`

### Configuration Overview

**Extends**:
- `eslint:recommended` - Standard ESLint rules
- `prettier` - Disables conflicting ESLint rules

**Environment**:
- Node.js (CommonJS modules)
- ES2021 syntax
- Jest (for test files)

### Key Rules

#### Code Quality
```javascript
// Unused variables (error)
'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]

// Console usage (warn, except in tests/scripts)
'no-console': ['warn', { allow: ['warn', 'error'] }]

// No debugger statements
'no-debugger': 'error'

// Prefer const over let
'prefer-const': 'error'

// No var declarations
'no-var': 'error'
```

#### Security
```javascript
// No dynamic code execution
'no-eval': 'error'
'no-implied-eval': 'error'
'no-new-func': 'error'

// No with statements
'no-with': 'error'
```

#### Best Practices
```javascript
// Always use === instead of ==
'eqeqeq': ['error', 'always']

// Always use curly braces
'curly': ['error', 'all']

// 1TBS brace style
'brace-style': ['error', '1tbs']

// No throwing literals
'no-throw-literal': 'error'
```

#### Style (Handled by Prettier)

Formatting rules (indent, quotes, semi, comma-dangle, trailing-spaces, eol-last) are handled by Prettier via `eslint-config-prettier`. They are **not** re-declared in `.eslintrc.js` to avoid conflicts. Prettier configuration in `.prettierrc.js` is the single source of truth for all formatting decisions.

### File Overrides

**Test Files** (`tests/**/*.js`, `scripts/**/*.js`):
- Allows `console.log()` (no warnings)
- Useful for debugging tests

**Ignored Patterns**:
- `node_modules/`
- `coverage/`
- `dist/`
- `build/`
- `*.min.js`

---

## Prettier Configuration

**File**: `.prettierrc.js`

### Configuration

```javascript
module.exports = {
  singleQuote: true,       // Use single quotes
  trailingComma: 'es5',    // Trailing commas where valid in ES5
  tabWidth: 2,             // 2 spaces per indentation
  semi: true,              // Always add semicolons
  printWidth: 100,         // Wrap at 100 characters
  arrowParens: 'avoid',    // Omit parens when possible (x => x)
  endOfLine: 'lf',         // Unix line endings
  bracketSpacing: true,    // Spaces in object literals { foo: bar }
};
```

### Prettier Ignore

**File**: `.prettierignore`

```
node_modules/
coverage/
dist/
build/
*.min.js
package-lock.json
.env
.env.test
logs/
backups/
```

---

## Local Pre-Commit Testing

**Best Practice**: Run linting and tests locally BEFORE pushing to avoid CI failures.

### Quick Pre-Commit Checklist

All commands must run inside Docker to match CI and ensure database access:

```bash
# 1. Format code
docker-compose exec web npm run format

# 2. Run linter
docker-compose exec web npm run lint

# 3. Run tests
docker-compose exec web npm test

# 4. Check coverage (optional)
docker-compose exec web npm run test:coverage
```

### Automated Pre-Commit Hook (Recommended)

Install `husky` and `lint-staged` for automatic pre-commit checks:

```bash
# Install dependencies
npm install --save-dev husky lint-staged

# Initialize husky
npx husky init

# Create pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

**Configuration** (add to `package.json`):
```json
{
  "lint-staged": {
    "*.js": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Benefit**: Automatically formats and lints staged files before commit.

### Testing Specific Changes

```bash
# Run specific test file
npm test -- tests/unit/models/User.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create user"

# Run integration tests only
npm run test:integration

# Run unit tests only
npm run test:unit
```

---

## Troubleshooting CI Failures

### Common Failure Scenarios

#### 1. Test Failures

**Symptom**: CI fails with test errors

**Diagnosis**:
```bash
# View failed test output in Actions tab
# Look for error messages and stack traces
```

**Common Causes**:
- Database connection issues (PostgreSQL not ready)
- Migration failures (missing/broken SQL)
- Flaky tests (timing/async issues)
- Environment variable mismatches

**Fix**:
```bash
# Run tests locally with same environment
NODE_ENV=test npm test

# Check database initialization
node scripts/init-db.js

# Verify migrations
psql -U ticketing_user -d ticketing_db -c "\dt"
```

#### 2. Coverage Threshold Failure

**Symptom**: CI fails with "Coverage for X dropped below Y%"

**Diagnosis**:
```bash
# Generate local coverage report
npm run test:coverage

# View HTML report
npm run test:coverage:html
```

**Thresholds** (must meet all):
- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

**Fix**:
- Add tests for uncovered code
- Focus on branches (if/else, switch, ternary)
- Cover error handlers
- Test edge cases

#### 3. ESLint Failures

**Symptom**: Lint workflow fails with ESLint errors

**Diagnosis**:
```bash
# Run ESLint locally
npm run lint
```

**Common Errors**:
```javascript
// no-unused-vars
const unused = 'value';
// Fix: Remove or prefix with underscore
const _unused = 'value';

// prefer-const
let name = 'John';
// Fix: Use const if not reassigned
const name = 'John';

// no-console (outside tests)
console.log('Debug');
// Fix: Use logger
logger.debug('Debug');

// eqeqeq
if (x == 5) {}
// Fix: Use strict equality
if (x === 5) {}
```

**Auto-Fix**:
```bash
# Auto-fix most linting issues
npm run lint:fix
```

#### 4. Prettier Failures

**Symptom**: Lint workflow fails with formatting errors

**Diagnosis**:
```bash
# Check which files need formatting
npm run format:check
```

**Fix**:
```bash
# Auto-format all files
npm run format

# Commit changes
git add .
git commit -m "chore: auto-format code with Prettier"
```

#### 5. npm Audit Failures

**Symptom**: Security job fails with vulnerability warnings

**Diagnosis**:
```bash
# Check vulnerabilities locally
npm audit

# See production-only vulnerabilities
npm audit --production
```

**Fix**:
```bash
# Auto-fix vulnerabilities (if possible)
npm audit fix

# Force fix (may cause breaking changes)
npm audit fix --force

# Manual update
npm update <package>

# If no fix available, document in PR
# Add exception with justification
```

#### 6. PostgreSQL Connection Timeout

**Symptom**: CI fails with "ECONNREFUSED" or "pg_isready timeout"

**Diagnosis**:
- PostgreSQL service didn't start in time
- Health check failed

**Fix**:
- Workflow already includes health checks
- Should auto-retry with `--health-interval 10s`
- If persistent, check GitHub Actions status page

---

## Badge Integration

### Adding Badges to README

**CI Workflow Badge**:
```markdown
[![CI](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/ci.yml/badge.svg)](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/ci.yml)
```

**Lint Workflow Badge**:
```markdown
[![Lint](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/lint.yml/badge.svg)](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/lint.yml)
```

**Coverage Badge** (via Codecov):
```markdown
[![codecov](https://codecov.io/gh/itheCreator1/KNII_Ticketing/branch/main/graph/badge.svg)](https://codecov.io/gh/itheCreator1/KNII_Ticketing)
```

**Custom Badge Colors**:
```markdown
![Tests](https://img.shields.io/badge/Tests-945%2F945%20Passing-green)
![Coverage](https://img.shields.io/badge/Coverage-84%25-orange)
```

---

## Best Practices

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Write Code + Tests**
   - Add tests for new features
   - Maintain or improve coverage

3. **Local Validation**
   ```bash
   npm run format        # Format code
   npm run lint          # Check linting
   npm test              # Run tests
   npm run test:coverage # Check coverage
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature

   - Implemented feature X
   - Added tests with 95% coverage
   - Updated documentation

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

5. **Push and Create PR**
   ```bash
   git push -u origin feature/my-feature
   ```

6. **Watch CI/CD Results**
   - CI workflow must pass
   - Lint workflow must pass
   - Coverage must meet thresholds

7. **Address Failures** (if any)
   ```bash
   # Fix issues locally
   npm run lint:fix
   npm run format
   npm test

   # Commit fixes
   git add .
   git commit -m "fix: address CI failures"
   git push
   ```

8. **Merge After Approval**
   - CI/CD passes ✅
   - Code reviewed ✅
   - Approved by maintainer ✅

### Writing CI-Friendly Code

1. **Always Use Logger** (not console.log)
   ```javascript
   // ❌ WRONG (fails linting)
   console.log('User created');

   // ✅ CORRECT
   logger.info('User created', { userId: user.id });
   ```

2. **Write Testable Code**
   ```javascript
   // ✅ Testable (pure function)
   function calculateTotal(items) {
     return items.reduce((sum, item) => sum + item.price, 0);
   }

   // ❌ Hard to test (side effects)
   function processOrder() {
     const items = fetchItemsFromDB();
     const total = items.reduce(...);
     saveToDatabase(total);
   }
   ```

3. **Use Environment Variables**
   ```javascript
   // ✅ CI-friendly
   const dbUrl = process.env.DATABASE_URL;

   // ❌ Hardcoded
   const dbUrl = 'postgresql://localhost:5432/mydb';
   ```

4. **Mock External Services**
   ```javascript
   // ✅ Mock in tests
   jest.mock('../services/emailService');

   // Test doesn't send real emails
   test('should send welcome email', () => {
     userService.createUser({ email: 'test@example.com' });
     expect(emailService.sendWelcomeEmail).toHaveBeenCalled();
   });
   ```

### Maintaining CI/CD

**Monthly Tasks**:
- Update dependencies (`npm update`)
- Run security audit (`npm audit`)
- Review and update coverage thresholds
- Check GitHub Actions usage quota

**When Adding Features**:
- Add tests (aim for 80%+ coverage)
- Run linting locally before push
- Update documentation
- Verify CI passes before requesting review

**When Updating Dependencies**:
- Check for breaking changes
- Run full test suite locally
- Monitor CI for unexpected failures
- Update lockfile (`npm ci`)

---

## Related Documentation

- **[Node.js Development Rules](node_js.md)** - Coding standards and patterns
- **[Testing Guidelines](testing_rules.md)** - Test structure and best practices
- **[Git Workflow](git_rules.md)** - Branching strategy and commit standards
- **[Debugging Guide](debug_rules.md)** - Troubleshooting CI and test failures

---

**Last Updated**: February 2026
**Version**: 2.4.0
**Maintained By**: KNII Development Team
