import { getOrderForTenant, getOrderItemsWithSeats } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { db } from '../db'
import { getTenantId } from '../tenant-context'

export async function getOrderHandler({ orderId }: { orderId: string }) {
  const tenantId = getTenantId()

  const [order] = await getOrderForTenant(db, orderId, tenantId)

  if (!order) {
    return {
      content: [{ type: 'text' as const, text: `Order ${orderId} not found` }],
      isError: true,
    }
  }

  const items = await getOrderItemsWithSeats(db, orderId)

  const result = {
    id: order.id,
    tenantId: order.tenantId,
    userId: order.userId,
    eventId: order.eventId,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt.toISOString(),
    items,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: result,
  }
}

export function registerGetOrder(server: McpServer) {
  server.registerTool(
    'get-order',
    {
      description: 'Get an order with its seat items by order ID',
      inputSchema: { orderId: z.string().uuid() },
    },
    getOrderHandler,
  )
}
