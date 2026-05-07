# AI Ticket

A conversational AI assistant that lets a live-event fan buy tickets through natural language chat — browse events, pick seats, and complete payment in a single conversation.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- An OpenAI API key (or Vercel AI Gateway token)

## Quick Start

```bash
git clone https://github.com/your-username/ai-ticket
cd ai-ticket
cp .env.example .env        # add your LLM_PROVIDER_API_KEY
docker compose up
```

Open [localhost:3000](http://localhost:3000).

## Demo

1. Pick a tenant — **Jazz Gallery** or **Empire Arts**
2. Type: *"What's on this weekend?"*
3. Type: *"Two tickets to the Friday jazz show, seats in the back"*
4. Confirm the seat suggestion
5. A payment modal appears — click **Pay Now**
6. You receive a booking confirmation number

To watch the full trace waterfall for any request, open [localhost:6006](http://localhost:6006) (Arize Phoenix) — no account needed.

## LLM Provider

Set these two variables in `.env`:

| Variable | Value |
|---|---|
| `LLM_PROVIDER` | `openai` or `vercel` |
| `LLM_PROVIDER_API_KEY` | Your API key |

---

## Development

### Requirements

- Node.js >= 24
- pnpm >= 10
- Python 3.12 (for the orchestrator)
- Docker Desktop

### Setup

```bash
pnpm install
```

Start infrastructure once and leave running:

```bash
docker compose up postgres stripe-mock phoenix
```

Run all apps locally with hot reload:

```bash
pnpm dev
```

### Database

Schema source of truth: `packages/db/src/schema.ts`

After any schema change:

```bash
pnpm db:schema                                        # generate migration + export schema.sql
docker compose down -v && docker compose up postgres  # wipe volume + re-seed
```

To inspect the database:

```bash
docker exec -it ai-ticket-postgres-1 psql -U postgres -d aiticket -c "SELECT * FROM tenants;"
```
