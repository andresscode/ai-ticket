#!/usr/bin/env bash
#
# End-to-end smoke for the BFF. Logs in via /auth/demo-login, drives the same
# chat → order → payment HITL flow as the orchestrator smoke script, and prints
# the AI SDK UI Message Stream parts the BFF sends back to the UI.
#
# Pre-reqs (you start these — the assistant doesn't run docker):
#   1. docker compose up postgres stripe-mock phoenix
#   2. pnpm --filter @ai-ticket/mcp-events    dev
#      pnpm --filter @ai-ticket/mcp-commerce  dev
#      pnpm --filter @ai-ticket/mcp-payments  dev
#   3. cd apps/orchestrator && pnpm dev
#   4. cd apps/bff && pnpm dev
#   5. apps/bff/.env has SESSION_SECRET, ORCHESTRATOR_URL, DATABASE_URL set
#   6. apps/orchestrator/.env has LLM_PROVIDER + LLM_PROVIDER_API_KEY set
#
# Override defaults via env vars:
#   BASE_URL (default http://localhost:3001)
#   TENANT_SLUG (default jazz-gallery from seed.sql; or empire-arts)
#   COOKIE_JAR (default /tmp/bff-smoke-cookies.txt)
#

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
TENANT_SLUG="${TENANT_SLUG:-jazz-gallery}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/bff-smoke-cookies.txt}"

hr() { printf -- '─%.0s' {1..72}; echo; }

echo "BASE_URL=$BASE_URL  TENANT_SLUG=$TENANT_SLUG  COOKIE_JAR=$COOKIE_JAR"
hr

rm -f "$COOKIE_JAR"

echo "→ /health"
curl -fsS "$BASE_URL/health"; echo
hr

echo "→ /auth/demo-login: tenant=$TENANT_SLUG"
curl -fsS -X POST "$BASE_URL/auth/demo-login" \
  -H 'Content-Type: application/json' \
  -c "$COOKIE_JAR" \
  -d "$(printf '{"tenant":"%s"}' "$TENANT_SLUG")"
echo; hr

echo "→ /auth/me"
curl -fsS "$BASE_URL/auth/me" -b "$COOKIE_JAR"; echo
hr

chat() {
  local message="$1"
  echo "→ /api/chat: $message"
  curl -N -fsS -X POST "$BASE_URL/api/chat" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d "$(printf '{"message":"%s"}' "$message")"
  echo; hr
}

resume() {
  local approved="$1"
  echo "→ /api/hitl/resume: approved=$approved"
  curl -N -fsS -X POST "$BASE_URL/api/hitl/resume" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d "$(printf '{"approved":%s}' "$approved")"
  echo; hr
}

chat "What events are coming up this week?"
chat "I want two seats for the soonest jazz show, somewhere in the back half of the venue."
chat "Yes, book those two seats."
chat "Pay for that order now."
# The previous /api/chat should end with a data-hitl part. Approve it.
resume true

echo "Phoenix traces: open http://localhost:6006 and pick the ai-ticket-orchestrator project."
