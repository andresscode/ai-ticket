import { findEventIdForTenant, suggestAvailableSeats } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
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

  const [event] = await findEventIdForTenant(db, eventId, tenantId)

  if (!event) {
    return {
      content: [{ type: 'text' as const, text: `Event ${eventId} not found` }],
      isError: true,
    }
  }

  const seats = await suggestAvailableSeats(db, {
    eventId,
    count,
    section,
    maxPriceCents,
  })

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
