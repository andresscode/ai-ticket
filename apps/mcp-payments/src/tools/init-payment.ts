import { getOrderForTenant, insertPayment } from '@ai-ticket/db'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { db } from '../db'
import { createPaymentIntent } from '../stripe'
import { getTenantId } from '../tenant-context'

export async function initPaymentHandler({ orderId }: { orderId: string }) {
  const tenantId = getTenantId()

  const [order] = await getOrderForTenant(db, orderId, tenantId)

  if (!order) {
    return {
      content: [{ type: 'text' as const, text: `Order ${orderId} not found` }],
      isError: true,
    }
  }

  if (order.status !== 'pending') {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Order ${orderId} is not pending (status: ${order.status})`,
        },
      ],
      isError: true,
    }
  }

  let intent: { id: string; status: string }
  try {
    intent = await createPaymentIntent(order.totalCents, 'usd')
  } catch (err) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Failed to create payment intent: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    }
  }

  const [payment] = await insertPayment(db, {
    orderId,
    stripePaymentIntentId: intent.id,
    amountCents: order.totalCents,
    currency: 'usd',
  })

  if (!payment) {
    return {
      content: [
        { type: 'text' as const, text: 'Failed to create payment record' },
      ],
      isError: true,
    }
  }

  const result = {
    paymentId: payment.id,
    orderId: payment.orderId,
    amountCents: payment.amountCents,
    currency: payment.currency,
    stripePaymentIntentId: payment.stripePaymentIntentId,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: result,
  }
}

export function registerInitPayment(server: McpServer) {
  server.registerTool(
    'init-payment',
    {
      description:
        'Initialise a Stripe payment intent for a pending order. Returns a paymentId to pass to complete-payment after user approval.',
      inputSchema: {
        orderId: z.string().uuid(),
      },
    },
    initPaymentHandler,
  )
}
