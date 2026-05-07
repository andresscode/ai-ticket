import { events, inventory } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { and, asc, eq, lte, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { getTenantId } from '../tenant-context'

type Input = {
  eventId: string
  count: number
  section?: 'front' | 'back' | 'balcony' | 'vip'
  maxPriceCents?: number
}

export async function suggestSeatsHandler({
  eventId,
  count,
  section,
  maxPriceCents,
}: Input) {
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

  const filters: SQL[] = [
    eq(inventory.eventId, eventId),
    eq(inventory.status, 'available'),
  ]
  if (section) filters.push(eq(inventory.section, section))
  if (maxPriceCents !== undefined)
    filters.push(lte(inventory.priceCents, maxPriceCents))

  const seats = await db
    .select()
    .from(inventory)
    .where(and(...filters))
    .orderBy(
      asc(inventory.priceCents),
      asc(inventory.section),
      asc(inventory.row),
      asc(inventory.seatNumber),
    )
    .limit(count)

  const result = seats.map((s) => ({
    id: s.id,
    section: s.section,
    row: s.row,
    seatNumber: s.seatNumber,
    priceCents: s.priceCents,
  }))

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: { seats: result },
  }
}

export function registerSuggestSeats(server: McpServer) {
  server.registerTool(
    'suggest-seats',
    {
      description:
        'Suggest available seats matching optional section and price filters',
      inputSchema: {
        eventId: z.string().uuid(),
        count: z.number().int().min(1).max(20),
        section: z.enum(['front', 'back', 'balcony', 'vip']).optional(),
        maxPriceCents: z.number().int().positive().optional(),
      },
    },
    suggestSeatsHandler,
  )
}
