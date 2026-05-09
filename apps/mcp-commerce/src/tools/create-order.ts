import {
  createOrderTx,
  findEventIdForTenant,
  findSeatsForEvent,
} from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { db } from '../db'
import { getTenantId, getUserId } from '../tenant-context'

export async function createOrderHandler({
  eventId,
  seatIds,
}: {
  eventId: string
  seatIds: string[]
}) {
  const tenantId = getTenantId()
  const userId = getUserId()

  const [event] = await findEventIdForTenant(db, eventId, tenantId)

  if (!event) {
    return {
      content: [{ type: 'text' as const, text: `Event ${eventId} not found` }],
      isError: true,
    }
  }

  const allSeats = await findSeatsForEvent(db, eventId, seatIds)

  const foundIds = new Set(allSeats.map((s) => s.id))
  const notFound = seatIds.filter((id) => !foundIds.has(id))
  const alreadyReserved = allSeats
    .filter((s) => s.status === 'reserved')
    .map((s) => s.id)
  const alreadySold = allSeats
    .filter((s) => s.status === 'sold')
    .map((s) => s.id)

  if (
    notFound.length > 0 ||
    alreadyReserved.length > 0 ||
    alreadySold.length > 0
  ) {
    const parts: string[] = []
    if (notFound.length) parts.push(`not found: ${notFound.join(', ')}`)
    if (alreadyReserved.length)
      parts.push(`already reserved: ${alreadyReserved.join(', ')}`)
    if (alreadySold.length)
      parts.push(`already sold: ${alreadySold.join(', ')}`)
    return {
      content: [{ type: 'text' as const, text: parts.join('; ') }],
      isError: true,
    }
  }

  const availableSeats = allSeats
  const totalCents = availableSeats.reduce((sum, s) => sum + s.priceCents, 0)

  const result = await (async () => {
    try {
      return await createOrderTx(db, {
        tenantId,
        userId,
        eventId,
        totalCents,
        seats: availableSeats.map((s) => ({
          id: s.id,
          priceCents: s.priceCents,
        })),
      })
    } catch {
      return null
    }
  })()

  if (!result) {
    return {
      content: [{ type: 'text' as const, text: 'Failed to create order' }],
      isError: true,
    }
  }

  const items = availableSeats.map((s) => ({
    inventoryId: s.id,
    section: s.section,
    row: s.row,
    seatNumber: s.seatNumber,
    priceCents: s.priceCents,
  }))

  const order = {
    id: result.id,
    tenantId: result.tenantId,
    userId: result.userId,
    eventId: result.eventId,
    status: result.status,
    totalCents: result.totalCents,
    createdAt: result.createdAt.toISOString(),
    items,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(order) }],
    structuredContent: order,
  }
}

export function registerCreateOrder(server: McpServer) {
  server.registerTool(
    'create-order',
    {
      description:
        'Create an order for one or more seats. Reserves the seats immediately.',
      inputSchema: {
        eventId: z.string().uuid(),
        seatIds: z.array(z.string().uuid()).min(1).max(20),
      },
    },
    createOrderHandler,
  )
}
