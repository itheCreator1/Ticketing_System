#!/usr/bin/env bash
# Per-worktree E2E: its own Compose project, images, and port; Playwright runs in its pinned container.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SLUG="$(basename "$ROOT" | tr -c 'a-zA-Z0-9\n' '-' | tr '[:upper:]' '[:lower:]')"
PROJECT="sd-e2e-${SLUG}"
export IMAGE_TAG="${SLUG}"
export E2E_HTTP_PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
PW_VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["devDependencies"]["@playwright/test"])' "$ROOT/frontend/package.json")"

compose() { docker compose -p "$PROJECT" -f "$ROOT/deploy/compose.yaml" -f "$ROOT/deploy/compose.e2e.yaml" "$@"; }
trap 'compose down -v --remove-orphans >/dev/null 2>&1 || true' EXIT

compose up -d --build --wait
compose exec -T backend python manage.py migrate --noinput
compose exec -T backend python manage.py seed_demo

docker run --rm --network host --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI \
  -e E2E_BASE_URL="http://127.0.0.1:${E2E_HTTP_PORT}" \
  -v "$ROOT/frontend:/work" -w /work \
  "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
  node_modules/.bin/playwright test "$@"
