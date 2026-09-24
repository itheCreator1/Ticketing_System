SHELL := /bin/bash
.DEFAULT_GOAL := help

# Worktree-scoped names: the checkout directory name becomes the slug.
SLUG := $(shell basename "$(CURDIR)" | tr -c 'a-zA-Z0-9\n' '_' | tr 'A-Z' 'a-z')
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
.PHONY: test-frontend
test-frontend: ## frontend unit tests with coverage gate; T=<file/pattern> for a single run
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
