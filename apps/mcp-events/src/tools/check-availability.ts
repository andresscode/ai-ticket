import { events, inventory } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { getTenantId } from '../tenant-context'

export async function checkAvailabilityHandler({
  eventId,
}: {
  eventId: string
}) {
  const tenantId = getTenantId()

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
    .limit(1)

  if (!event) {
    return {
      content: [{ type: 'text' as const, text: `Event ${eventId} not found` }],
      isError: true,
    }
  }

  const rows = await db
    .select({
      section: inventory.section,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(inventory)
    .where(
      and(eq(inventory.eventId, eventId), eq(inventory.status, 'available')),
    )
    .groupBy(inventory.section)

  const bySection = Object.fromEntries(rows.map((r) => [r.section, r.count]))
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  const result = { bySection, total }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: result,
  }
}

export function registerCheckAvailability(server: McpServer) {
  server.registerTool(
    'check-availability',
    {
      description: 'Check available seat counts by section for an event',
      inputSchema: { eventId: z.string().uuid() },
    },
    checkAvailabilityHandler,
  )
}
