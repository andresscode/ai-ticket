import { events } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { getTenantId } from '../tenant-context'

export async function getEventHandler({ eventId }: { eventId: string }) {
  const tenantId = getTenantId()
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
    .limit(1)

  if (!row) {
    return {
      content: [{ type: 'text' as const, text: `Event ${eventId} not found` }],
      isError: true,
    }
  }

  const event = {
    id: row.id,
    name: row.name,
    description: row.description,
    venue: row.venue,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    imageUrl: row.imageUrl,
    status: row.status,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(event) }],
    structuredContent: event,
  }
}

export function registerGetEvent(server: McpServer) {
  server.registerTool(
    'get-event',
    {
      description: 'Get full details of a specific event',
      inputSchema: { eventId: z.string().uuid() },
    },
    getEventHandler,
  )
}
