# Service Desk

A support-ticket system for several customer organizations. Customers see only their own organization's tickets, and staff see the organizations and people they have been granted.

- **Backend:** Django 5.2 LTS and Django REST Framework on PostgreSQL
- **Frontend:** Next.js 16, served from the same origin
- **Runtime:** Docker Compose with Caddy as the reverse proxy, plus a supercronic scheduler

Status: Phase 1a (repository, infrastructure, and testing foundations) is done.

## Requirements

- Docker with Compose
- [mise](https://mise.jdx.dev) (installs Node 22 and pnpm)
- [uv](https://docs.astral.sh/uv/) (installs Python 3.13)
- `flock` from util-linux (on macOS: `brew install flock`)

## Getting started

```sh
mise trust && mise install
make up        # dev stack on http://127.0.0.1:8080
make migrate
docker compose -p sd-dev -f deploy/compose.yaml -f deploy/compose.dev.yaml exec backend python manage.py seed_demo
make smoke
```

Every demo user's password is `demo-password-123`. Run `make down` to stop the stack.

## Tests and checks

| Command | What it runs |
|---|---|
| `make test` | every layer: backend (pytest), frontend (Vitest), and E2E (Playwright) |
| `make test-backend`, `make test-frontend`, `make test-e2e` | one layer; add `T=<path or pattern>` for a single test |
| `make scope-mutation-check` | proves the access-scope tests fail when scoping is removed |
| `make coverage-backend`, `make lint`, `make typecheck`, `make security`, `make openapi-check` | the same gates as CI |

Always run tests through `make`. It gives each checkout its own test database and E2E stack, so several worktrees can run tests at the same time.
