SHELL := /bin/bash
.DEFAULT_GOAL := help

# Worktree-scoped names: the checkout directory name becomes the slug.
SLUG := $(shell basename "$(CURDIR)" | tr -c 'a-zA-Z0-9\n' '_' | tr '[:upper:]' '[:lower:]')
export SD_TEST_DB ?= test_sd_$(SLUG)

DEV := docker compose -p sd-dev -f deploy/compose.yaml -f deploy/compose.dev.yaml
T ?=

.PHONY: help db test-backend
help:
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/ —/'

db: ## start the shared dev PostgreSQL (skipped when SD_EXTERNAL_DB=1, e.g. CI service)
	@if [ -z "$$SD_EXTERNAL_DB" ]; then $(DEV) up -d --wait db; fi

test-backend: db ## backend tests; T=<path/-k expr> for a single RED/GREEN run
	cd backend && uv run pytest $(if $(T),$(T),-n auto)

.PHONY: scope-mutation-check
scope-mutation-check: db ## scope tests must FAIL when scoping is removed
	@cd backend && if uv run pytest -m scope --scope-mutation -q -n auto; then \
	  echo "SCOPE MUTATION CHECK FAILED: scope tests still pass with scoping removed"; exit 1; \
	else echo "Scope mutation check OK: scope tests fail without scoping"; fi

.PHONY: openapi openapi-check
openapi: ## regenerate backend/openapi.yaml (and frontend types once the frontend exists)
	cd backend && uv run python manage.py spectacular --file openapi.yaml --validate --fail-on-warn
	@if [ -f frontend/package.json ]; then cd frontend && mise exec -- pnpm gen:api; fi

openapi-check: openapi ## fails if the committed schema/types drift from the code
	git diff --exit-code -- backend/openapi.yaml frontend/src/lib/api/schema.d.ts

PNPM := mise exec -- pnpm

# Install frontend dependencies from the lockfile when missing or outdated (clean clones, new worktrees).
frontend/node_modules/.modules.yaml: frontend/package.json frontend/pnpm-lock.yaml
	cd frontend && $(PNPM) install --frozen-lockfile

.PHONY: test-frontend
test-frontend: frontend/node_modules/.modules.yaml ## frontend unit tests with coverage gate; T=<file/pattern> for a single run
	cd frontend && $(if $(T),$(PNPM) exec vitest run $(T),$(PNPM) test:coverage)

.PHONY: up down migrate smoke
up: ## full dev stack on http://127.0.0.1:8080
	$(DEV) up -d --build --wait
migrate:
	$(DEV) exec -T backend python manage.py migrate --noinput
down:
	$(DEV) down
smoke: ## smoke test against the running dev stack
	deploy/smoke.sh http://127.0.0.1:8080

.PHONY: test-e2e
test-e2e: frontend/node_modules/.modules.yaml ## E2E on a per-worktree stack; T="e2e/smoke.spec.ts" or T="--project=quarantine"
	scripts/run-e2e.sh $(if $(T),$(T),--project=gating)

.PHONY: lint typecheck security coverage-backend test
lint: frontend/node_modules/.modules.yaml ## ruff + eslint + prettier
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && $(PNPM) lint && $(PNPM) format:check

typecheck: frontend/node_modules/.modules.yaml
	cd backend && uv run mypy .
	cd frontend && $(PNPM) typecheck

security: ## dependency audit, static analysis, secret scan (Trivy runs in CI after image build)
	cd backend && uv export --no-hashes --format requirements-txt > /tmp/sd-reqs.txt && uv run pip-audit -r /tmp/sd-reqs.txt
	cd backend && uv run bandit -c pyproject.toml -r . -q
	cd frontend && $(PNPM) audit --audit-level high
	docker run --rm -v "$(CURDIR):/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 dir /repo --config /repo/.gitleaks.toml --no-banner --redact

coverage-backend: db ## 85% overall, 95% for each of access/ accounts/ tickets/
	cd backend && uv run pytest -n auto --cov --cov-report= \
	  && uv run coverage report --fail-under=85 \
	  && for app in access accounts tickets; do uv run coverage report --include="$$app/*" --fail-under=95 || exit 1; done

test: test-backend test-frontend test-e2e ## all layers
