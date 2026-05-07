import { events } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../db'
import { getTenantId } from '../tenant-context'

export async function listEventsHandler() {
  const tenantId = getTenantId()
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        eq(events.status, 'active'),
        gt(events.startsAt, new Date()),
      ),
    )
    .orderBy(events.startsAt)

  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    venue: r.venue,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    imageUrl: r.imageUrl,
    status: r.status,
  }))

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: { events: result },
  }
}

export function registerListEvents(server: McpServer) {
  server.registerTool(
    'list-events',
    { description: 'List upcoming active events for the current tenant' },
    listEventsHandler,
  )
}
