import { listUpcomingEventsForTenant } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { db } from '../db'
import { getTenantId } from '../tenant-context'

export async function listEventsHandler() {
  const tenantId = getTenantId()
  const rows = await listUpcomingEventsForTenant(db, tenantId)

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
