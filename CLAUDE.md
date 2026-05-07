# AI Ticket — Claude Code Context

## What This Is

Conversational AI assistant for buying live-event tickets through natural language chat — browse events, select seats, and complete payment in a single conversation.

## Stack

- **MCP Servers** — TypeScript/Node.js, Streamable HTTP, Zod validation, Drizzle ORM
- **Orchestration** — Python 3.12, FastAPI, LangGraph supervisor + specialist agents
- **BFF** — Node.js/Hono, Vercel AI SDK `streamText`, cookie sessions
- **UI** — React 19, Vite, Shadcn/ui, TailwindCSS, AI SDK `useChat`
- **DB** — PostgreSQL 16, Drizzle ORM, `packages/db` is the schema source of truth
- **Observability** — Arize Phoenix (localhost:6006)
- **Infra** — Docker Compose (9 services), stripe-mock for payments

## Monorepo Structure

```
apps/        # mcp-events, mcp-commerce, mcp-payments, orchestrator, bff, ui
packages/    # @ai-ticket/tsconfig, @ai-ticket/db, @ai-ticket/types
postgres/    # schema.sql (generated), seed.sql
```

## Tooling

- `pnpm` workspaces — catalog in `pnpm-workspace.yaml` for shared dep versions
- Biome — lint + format for all TS/TSX
- Lefthook — pre-commit (Biome) + commit-msg (commitlint)
- Conventional commits enforced

## Key Rules

- Never add deps or scripts to a `package.json` until they are actually installed
- Each app manages its own db connection — `packages/db` exports schema/types only, never connects
- MCP servers are the only callers of the database — orchestrator never queries DB directly
- Docker Compose is for infra only during dev (`postgres`, `stripe-mock`, `phoenix`) — apps run locally with hot reload

## Port Assignments

| Service | Port |
|---|---|
| UI | 3000 |
| BFF | 3001 |
| MCP Events | 3002 |
| MCP Commerce | 3003 |
| MCP Payments | 3004 |
| Orchestrator | 8000 |
| Postgres | 5432 |
| Stripe Mock | 12111 |
| Arize Phoenix | 6006 |

## Database Workflow

Schema lives in `packages/db/src/schema.ts`. After any schema change:

```bash
pnpm db:schema                                        # generate migration + export schema.sql
docker compose down -v && docker compose up postgres  # wipe volume + re-seed
```
