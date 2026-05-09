#!/usr/bin/env bash
#
# End-to-end smoke for the orchestrator. Drives a chat → order → payment HITL
# flow through the graph via the orchestrator's HTTP routes and prints the
# streamed SSE events for each step.
#
# Pre-reqs (you start these — the assistant doesn't run docker):
#   1. docker compose up postgres stripe-mock phoenix
#   2. pnpm --filter @ai-ticket/mcp-events    dev
#      pnpm --filter @ai-ticket/mcp-commerce  dev
#      pnpm --filter @ai-ticket/mcp-payments  dev
#   3. cd apps/orchestrator && pnpm dev
#   4. apps/orchestrator/.env has LLM_PROVIDER + LLM_PROVIDER_API_KEY set
#
# Override defaults via env vars:
#   BASE_URL (default http://localhost:8000)
#   TENANT_ID (default Jazz Gallery from seed.sql)
#   USER_ID (default u-demo)
#   THREAD_ID (default smoke-<unix-seconds>)
#

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
TENANT_ID="${TENANT_ID:-a0000000-0000-0000-0000-000000000001}"
USER_ID="${USER_ID:-u-demo}"
THREAD_ID="${THREAD_ID:-smoke-$(date +%s)}"

hr() { printf -- '─%.0s' {1..72}; echo; }

echo "BASE_URL=$BASE_URL  TENANT_ID=$TENANT_ID  USER_ID=$USER_ID  THREAD_ID=$THREAD_ID"
hr

echo "→ /health"
curl -fsS "$BASE_URL/health"; echo
hr

chat() {
  local message="$1"
  echo "→ /chat: $message"
  curl -N -fsS -X POST "$BASE_URL/chat" \
    -H 'Content-Type: application/json' \
    -d "$(printf '{"tenant_id":"%s","user_id":"%s","thread_id":"%s","message":"%s"}' \
        "$TENANT_ID" "$USER_ID" "$THREAD_ID" "$message")"
  echo; hr
}

resume() {
  local approved="$1"
  echo "→ /hitl/resume: approved=$approved"
  curl -N -fsS -X POST "$BASE_URL/hitl/resume" \
    -H 'Content-Type: application/json' \
    -d "$(printf '{"tenant_id":"%s","user_id":"%s","thread_id":"%s","approved":%s}' \
        "$TENANT_ID" "$USER_ID" "$THREAD_ID" "$approved")"
  echo; hr
}

chat "What events are coming up this week?"
chat "I want two seats for the soonest jazz show, somewhere in the back half of the venue."
chat "Yes, book those two seats."
chat "Pay for that order now."
# The previous /chat should end with an hitl_required event. Approve it.
resume true

echo "Phoenix traces: open http://localhost:6006 and pick the ai-ticket-orchestrator project."
