# AI Ticket

A conversational AI assistant that lets a live-event fan buy tickets through natural language chat — browse events, pick seats, and complete payment in a single conversation.

---

## Running the Demo

### Step 1 — Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- An OpenAI API key (or Vercel AI Gateway token)

### Step 2 — Configure your API key

```bash
git clone https://github.com/your-username/ai-ticket
cd ai-ticket
cp .env.example .env
```

Open `.env` and set:

| Variable | Value |
|---|---|
| `LLM_PROVIDER` | `openai` or `vercel` |
| `LLM_PROVIDER_API_KEY` | Your API key |

### Step 3 — Start the stack

```bash
docker compose up
```

Wait for all services to report healthy, then open [localhost:3000](http://localhost:3000).

### Step 4 — Run the happy path

1. Pick a tenant — **Jazz Gallery** or **Empire Arts**
2. Type: *"What's on this weekend?"*
3. Type: *"Two tickets to the Friday jazz show, seats in the back"*
4. Confirm the seat suggestion
5. A payment modal appears — click **Pay Now**
6. You receive a booking confirmation number

Total time: ~60 seconds. Every layer of the stack fires.

### Step 5 — Watch the trace

Open [localhost:6006](http://localhost:6006) (Arize Phoenix) — no account needed. You'll see the full trace waterfall for the request: supervisor routing, agent hops, MCP tool calls, LLM token counts, and latency.

### Try different seat sections

Each event has inventory across up to four sections. Use these prompts to explore them:

| What you want to see | Example prompt |
|---|---|
| Front (closest to stage) | *"Two tickets to the jazz show, as close to the stage as possible"* |
| Back (affordable floor) | *"Two tickets to Saturday's show, somewhere in the back"* |
| Balcony (budget) | *"Two tickets under $40 each, balcony is fine"* |
| VIP | *"One VIP ticket to opening night"* |
| Budget cap across sections | *"Two tickets to Hamlet, total budget under $100"* |
| Let the AI decide | *"Two tickets to the jazz show, surprise me"* |

| Section | Position | Price range |
|---|---|---|
| `front` | Closest to the stage | $$$ |
| `back` | Rear of the floor | $$ |
| `balcony` | Elevated rear gallery | $ |
| `vip` | Side-stage reserved | $$$$ |

> **If events appear in the past:** the Postgres volume is stale. Run `docker compose down -v && docker compose up` to wipe and re-seed — event dates are always set relative to first boot.

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

### Testing MCP Servers

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to interactively call tools on any MCP server without the full orchestrator stack.

Make sure the target MCP server is running locally (e.g. `pnpm dev` or run the app directly), then launch the inspector:

```bash
pnpx @modelcontextprotocol/inspector
```

This opens a browser UI at [localhost:6274](http://localhost:6274). Connect it to whichever server you want to test:

| Server | URL |
|---|---|
| MCP Events | `http://localhost:3002/mcp` |
| MCP Commerce | `http://localhost:3003/mcp` |
| MCP Payments | `http://localhost:3004/mcp` |

From the inspector you can browse available tools, supply arguments, and inspect the raw JSON responses — useful for verifying tool schemas and debugging before wiring a server into the orchestrator.
