# AI Ticket

A conversational AI assistant that lets a live-event fan buy tickets through natural language chat — browse events, pick seats by section, and complete payment in a single conversation.

![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white&style=flat)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white&style=flat)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat)
![LangGraph](https://img.shields.io/badge/LangGraph-multi--agent-1C3C3C?style=flat)
![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-6B46C1?style=flat)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white&style=flat)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white&style=flat)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white&style=flat)

> **Status:** Demo-grade implementation. See [ARCHITECTURE.md](./ARCHITECTURE.md) for known gaps and deliberate scope cuts.

---

## Running the Demo

### Step 1 — Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- An OpenAI or Vercel AI Gateway API key

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
2. Type: *"What's on this week?"*
3. Select one event and ask the agent to book your seats. Provide the section (back, front, balcony, VIP) and a budget.
4. Once the agent confirms your seats. Check **My Tickets** at the top-right corner. It should be in *Pending*.
5. Tell the assistant you want to pay your tickets and a payment modal appears — click **Pay Now**.
6. You receive a booking confirmation number
7. Click **My Tickets** in the header to see the order — status moves from *Pending* to *Confirmed* once payment completes

Total time: ~60 seconds. Every layer of the stack fires.

### Step 5 — Watch the trace

Open [localhost:6006](http://localhost:6006) (Arize Phoenix) — no account needed. You'll see the full trace waterfall for the request: supervisor routing, agent hops, MCP tool calls, LLM token counts, cost, and latency.

### Try different seat sections

> **Note:** This is a demo — the agent has not been tested for edge cases and may produce unexpected responses outside the happy path. Stick to the flow described above for the most reliable experience.

Each event has inventory across up to four sections.

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
# generate migration + export schema.sql
pnpm db:schema

# wipe volume + re-seed
docker compose down -v && docker compose up postgres
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

---

## Known Limitations

This is a scoped demo — not a production-ready product. A few gaps worth knowing about:

- **Frontend error handling** — orchestrator and MCP errors are surfaced as raw messages in the chat. A production UI would distinguish network errors, payment failures, and out-of-stock states with tailored copy and retry affordances.
- **Vercel AI Gateway provider** — the `vercel` provider path (Gemini models via the gateway) is functional but less tested. The supervisor occasionally repeats content already provided by a sub-agent; this is a prompting issue specific to that model family and would need iteration to resolve.
- **Test coverage** — the pytest suite covers stream serialization, moderation, and guardrails. Supervisor routing logic and the HITL payment flow have no automated tests. A production system would need broader coverage and edge-case handling.
- **Evals** — offline evaluation with `phoenix.evals` was scoped out due to time constraints. For a production system, intent classification accuracy and end-to-end flow correctness should be measured with a golden dataset on every significant model or prompt change.
- **Agent capabilities** — the implemented flow covers the happy path only. Many real-world features are absent: order cancellation, seat map rendering by row, looking up orders from a previous session or by confirmation number, modifying an existing order, waitlisting, and multi-event cart flows. These would each require new MCP tools, agent instructions, and UI components.

Full architectural rationale and tradeoff notes live in [ARCHITECTURE.md](./ARCHITECTURE.md).
