import {
  completePaymentTx,
  findPaymentById,
  getOrderForTenant,
  getOrderItemInventoryIds,
} from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
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

  const [payment] = await findPaymentById(db, paymentId)

  if (!payment) {
    return {
      content: [
        { type: 'text' as const, text: `Payment ${paymentId} not found` },
      ],
      isError: true,
    }
  }

  const [order] = await getOrderForTenant(db, payment.orderId, tenantId)

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

  const itemRows = await getOrderItemInventoryIds(db, payment.orderId)

  const inventoryIds = itemRows.map((r) => r.inventoryId)

  const result = await (async () => {
    try {
      return await completePaymentTx(db, {
        paymentId,
        orderId: payment.orderId,
        inventoryIds,
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
