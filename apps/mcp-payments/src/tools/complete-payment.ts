import { inventory, orderItems, orders, payments } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { confirmPaymentIntent } from '../stripe'
import { getTenantId } from '../tenant-context'

export async function completePaymentHandler({
  paymentId,
}: {
  paymentId: string
}) {
  const tenantId = getTenantId()

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) {
    return {
      content: [
        { type: 'text' as const, text: `Payment ${paymentId} not found` },
      ],
      isError: true,
    }
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, payment.orderId), eq(orders.tenantId, tenantId)))
    .limit(1)

  if (!order) {
    return {
      content: [
        { type: 'text' as const, text: `Order ${payment.orderId} not found` },
      ],
      isError: true,
    }
  }

  try {
    await confirmPaymentIntent(payment.stripePaymentIntentId)
  } catch (err) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Payment confirmation failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    }
  }

  // Fetch inventory IDs before the transaction so the tx contains only writes
  const itemRows = await db
    .select({ inventoryId: orderItems.inventoryId })
    .from(orderItems)
    .where(eq(orderItems.orderId, payment.orderId))
    .limit(100)

  const inventoryIds = itemRows.map((r) => r.inventoryId)

  const result = await (async () => {
    try {
      return await db.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ status: 'succeeded' })
          .where(eq(payments.id, paymentId))

        await tx
          .update(orders)
          .set({ status: 'confirmed' })
          .where(eq(orders.id, payment.orderId))

        if (inventoryIds.length > 0) {
          await tx
            .update(inventory)
            .set({ status: 'sold' })
            .where(inArray(inventory.id, inventoryIds))
        }

        return true
      })
    } catch {
      return null
    }
  })()

  if (!result) {
    return {
      content: [{ type: 'text' as const, text: 'Failed to complete payment' }],
      isError: true,
    }
  }

  const confirmation = {
    paymentId,
    orderId: payment.orderId,
    status: 'succeeded',
    amountCents: payment.amountCents,
    confirmationNumber: paymentId.slice(0, 8).toUpperCase(),
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(confirmation) }],
    structuredContent: confirmation,
  }
}

export function registerCompletePayment(server: McpServer) {
  server.registerTool(
    'complete-payment',
    {
      description:
        'Confirm a Stripe payment and finalise the order. Marks the payment as succeeded, the order as confirmed, and all reserved seats as sold.',
      inputSchema: {
        paymentId: z.string().uuid(),
      },
    },
    completePaymentHandler,
  )
}
