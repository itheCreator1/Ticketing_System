#!/usr/bin/env bash
# Smoke test through Caddy: API health, and a page that performs a server-side read of the API.
set -euo pipefail
BASE="${1:?usage: smoke.sh <base-url>}"
curl -fsS "$BASE/api/v1/health/" | grep -q '"status":"ok"' || { echo "FAIL: API health"; exit 1; }
page="$(curl -fsS "$BASE/")"
grep -q 'data-testid="backend-status"' <<<"$page" || { echo "FAIL: page did not render"; exit 1; }
grep -q 'Backend status: ok' <<<"$page" || { echo "FAIL: server-side read through the internal API"; exit 1; }
echo "smoke OK: $BASE"
