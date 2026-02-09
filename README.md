# KNII Ticketing System

**Professional Support Ticket Management Platform**

[![CI](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/ci.yml/badge.svg)](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/ci.yml)
[![Lint](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/lint.yml/badge.svg)](https://github.com/itheCreator1/KNII_Ticketing/actions/workflows/lint.yml)
![Node.js 20](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![Express 5.x](https://img.shields.io/badge/Express-5.x-000000?logo=express)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Tests](https://img.shields.io/badge/Tests-945%2F945%20Passing-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-67%25-yellow)

**Version 2.4.0** | [Quick Start](#quick-start) | [Features](#features) |
[Architecture](#architecture) | [Testing](#testing) |
[Documentation](#documentation)

---

## Quick Start

### Prerequisites

- Docker & Docker Compose

### Setup

```bash
git clone https://github.com/itheCreator1/KNII_Ticketing.git
cd KNII_Ticketing
docker-compose up --build
```

Open `http://localhost:3000` and log in:

```
Username: admin
Password: admin123
Role:     super_admin
```

> **Change default credentials immediately in production.**

### Run Tests

All tests **must** run inside the Docker container:

```bash
docker-compose exec web npm test                  # All 945 tests
docker-compose exec web npm run test:unit         # Unit tests (416)
docker-compose exec web npm run test:integration  # Integration + E2E (529)
docker-compose exec web npm run test:coverage     # With coverage report
```

---

## Features

### Dual-Portal Architecture

**Client Portal** (`/client/*`) — Department users manage their own department's
tickets:

- Create tickets (auto-populated department info)
- View all tickets within own department
- Add public comments
- Update status (waiting_on_admin, closed)

**Admin Portal** (`/admin/*`) — Support staff manage all tickets:

- View and manage all tickets (department + internal)
- Create tickets on behalf of departments
- Create internal admin-only tickets
- Add public or internal comments
- Assign tickets to staff
- Manage users and departments (super_admin)

### Security

- Parameterized SQL queries (zero injection surface)
- CSRF protection (double-submit cookie pattern)
- Rate limiting: login (10/15min), admin mutations (20/min)
- bcrypt password hashing (cost 10)
- Account lockout after 5 failed attempts
- Session security (httpOnly, secure, sameSite strict)
- Department-based access control
- Search input sanitization
- Audit logging on all admin actions

### Workflow

Tickets move through five states: **open**, **in_progress**,
**waiting_on_admin**, **waiting_on_department**, **closed**.

Three roles control access: **super_admin**, **admin**, **department**.

Five priority levels: **unset**, **low**, **medium**, **high**, **critical**.

---

## Architecture

**Stack**: Node.js 20 | Express 5.x | PostgreSQL 16 | EJS | Docker | PM2

**No ORM** — raw SQL with the `pg` driver. All queries are parameterized.

```
HTTP Request
  -> Rate Limiter
  -> CSRF Protection
  -> Authentication (requireAuth)
  -> Authorization (requireAdmin / requireSuperAdmin / requireDepartment)
  -> Input Validation (express-validator)
  -> Route Handler
    -> Service Layer (business logic)
      -> Model Layer (parameterized SQL)
        -> PostgreSQL
  <- Response (redirect / render)
```

```
├── config/           Database pool, session config
├── constants/        Enums, messages, validation rules
├── middleware/       Auth, validation, error handling, rate limiting
├── migrations/       25 SQL migrations (sequential, never modify after deploy)
├── models/           Static class methods (no instantiation)
├── routes/           Express routers (public, auth, admin, client)
├── services/         Business logic
├── utils/            Logger, sanitization, password validation
├── validators/       express-validator chains
└── views/            EJS templates
```

### Database

7 tables across 25 migrations:

| Table         | Purpose                                                   |
| ------------- | --------------------------------------------------------- |
| `departments` | Department management with floor FK                       |
| `users`       | Authentication with RBAC (admin, super_admin, department) |
| `tickets`     | Support tickets with department FK and workflow states    |
| `comments`    | Public and internal comments with visibility control      |
| `audit_logs`  | Admin action tracking (compliance)                        |
| `floors`      | Building floor locations (database-driven)                |
| `session`     | Session storage (connect-pg-simple)                       |

---

## Testing

**945 / 945 passing** across 38 test suites. Zero failures, zero skipped.

| Category          | Tests | Status |
| ----------------- | ----- | ------ |
| Unit              | 416   | Pass   |
| Database          | 112   | Pass   |
| Integration / E2E | 417   | Pass   |

### Infrastructure

- **Sequential execution**: `--runInBand` on all test scripts (prevents
  cross-suite PostgreSQL contamination)
- **Transaction isolation**: Unit tests use dedicated clients with rollback
- **FK-aware cleanup**: Correct deletion order across all tables
- **Floor seeding**: Runs before departments to satisfy FK constraints
- **Coverage thresholds**: 60% minimum (branches, functions, lines, statements)

---

## CI/CD

Two GitHub Actions workflows run on every push and pull request.

### CI Workflow — Docker-Based Testing

Tests run **inside Docker containers**, identical to local development:

```bash
docker compose -f docker-compose.ci.yml up --build --exit-code-from web
```

- Builds the app image and starts PostgreSQL with healthcheck
- Entrypoint handles database readiness and migrations
- Runs all 945 tests with coverage inside the container
- Uploads coverage report as build artifact (14-day retention)
- `--exit-code-from web` fails the CI job if any test fails

**Security audit** runs in parallel:

- `npm audit --omit=dev --audit-level=high` — hard fail on high/critical
  vulnerabilities
- `npm audit --audit-level=moderate` — informational only

### Lint Workflow

- ESLint: zero errors required (style rules handled by Prettier)
- Prettier: zero formatting drift allowed

---

## Development

### Commands

```bash
# Start
docker-compose up --build          # Docker (recommended)
npm run dev                        # Local (nodemon)

# Test (inside Docker)
docker-compose exec web npm test
docker-compose exec web npm run test:coverage

# Code quality
npm run lint                       # ESLint
npm run lint:fix                   # Auto-fix
npm run format                     # Prettier
npm run format:check               # Check only

# Database
docker-compose exec web node scripts/init-db.js
docker-compose exec web npm run seed:hospital
docker-compose exec web npm run seed:sample
```

### Pre-Commit Checklist

```bash
docker-compose exec web npm run format
docker-compose exec web npm run lint
docker-compose exec web npm test
```

### Environment Variables

| Variable         | Required | Description                              |
| ---------------- | -------- | ---------------------------------------- |
| `DATABASE_URL`   | Yes      | PostgreSQL connection string             |
| `SESSION_SECRET` | Yes      | Min 32 characters                        |
| `NODE_ENV`       | Yes      | production, development, or test         |
| `PORT`           | No       | Default 3000                             |
| `LOG_LEVEL`      | No       | error, warn, info, debug (default: info) |

---

## Documentation

| Guide                                                | Description                                       |
| ---------------------------------------------------- | ------------------------------------------------- |
| [Node.js Development Rules](docs/node_js.md)         | Coding standards, architecture, security patterns |
| [Debugging & Troubleshooting](docs/debug_rules.md)   | Logging, error handling, performance              |
| [Testing Guidelines](docs/testing_rules.md)          | Test structure, patterns, infrastructure          |
| [CI/CD Guide](docs/ci-cd.md)                         | Workflows, ESLint, Prettier, troubleshooting      |
| [Git Workflow](docs/git_rules.md)                    | Branching, commits, PR discipline                 |
| [Deployment Guide](docs/howToDeploy.md)              | Docker production, PM2, environment setup         |
| [Customization Guide](docs/customisation_guide.md)   | Floors, departments, seed data                    |
| [Performance Baseline](docs/performance-baseline.md) | SLA targets, benchmarks                           |
| [CLAUDE.md](CLAUDE.md)                               | Complete project context for AI assistants        |

---

## Deployment

```bash
# Production
docker-compose -f docker-compose.prod.yml up --build -d
docker-compose -f docker-compose.prod.yml exec web node scripts/init-db.js
```

### Checklist

- [ ] All 25 migrations run (000-025)
- [ ] `SESSION_SECRET` set (min 32 chars)
- [ ] `NODE_ENV=production`
- [ ] Default admin password changed
- [ ] CI/CD workflows passing
- [ ] Database backed up

---

## Changelog

<details>
<summary><strong>v2.4.0</strong> (Current - February 2026)</summary>

### Docker-Based CI/CD

- Tests run inside Docker containers in CI, matching local dev
- `docker-compose.ci.yml` for CI-specific test execution
- `--exit-code-from web` propagates test failures to CI
- Coverage uploaded as build artifact
- Production dependency audit gates builds

### 100% Test Pass Rate

- All 945 tests passing (38 suites, 0 failures)
- `--runInBand` enforced on all test scripts
- Coverage thresholds set to 60%

### Code Quality

- Zero ESLint errors (style rules delegated to Prettier)
- Zero Prettier formatting issues
- Resolved ESLint/Prettier comma-dangle conflict
- Fixed all unused variable warnings

### Security

- Patched `qs` (high) and `lodash` (moderate) vulnerabilities
- CI enforces `npm audit --omit=dev --audit-level=high`

</details>

<details>
<summary><strong>v2.3.0</strong> (January 2026)</summary>

- Test infrastructure: floor seeding, FK-aware cleanup, pool cleanup
- Performance: composite indexes (50-80% dashboard improvement)
- Security: admin mutation rate limiter, search sanitization
- CI/CD: GitHub Actions workflows for testing and linting
- Code quality: ESLint + Prettier configuration
- Migrations 022-025

</details>

<details>
<summary><strong>v2.2.0</strong> (January 2026)</summary>

- Department floor locations with CHECK constraint
- Admin-created department tickets visible to department users
- Department-based access control (replaces user-based)
- Migration 020: add_department_floor

</details>

<details>
<summary><strong>v2.1.0</strong> (January 2026)</summary>

- Dual-portal architecture (client + admin)
- Department user role
- Public/internal comment visibility
- Admin creation of department tickets

</details>

---

## License

Proprietary and confidential. Copyright 2026 KNII Team. All rights reserved.

---

**Version 2.4.0** | Node.js 20 | Express 5.x | PostgreSQL 16
