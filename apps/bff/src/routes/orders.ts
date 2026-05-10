import { getOrderItemsWithSeats, getOrdersForUser } from '@ai-ticket/db'
import { Hono } from 'hono'
import { db } from '../db'
import {
  type AuthedVariables,
  requireSession,
} from '../middleware/require-session'

export const ordersRoutes = new Hono<{ Variables: AuthedVariables }>()

ordersRoutes.get('/api/orders', requireSession, async (c) => {
  const { userId, tenantId } = c.get('currentSession')

  const rows = await getOrdersForUser(db, userId, tenantId)

  const orders = await Promise.all(
    rows.map(async (order) => {
      const seats = await getOrderItemsWithSeats(db, order.id)
      return {
        id: order.id,
        status: order.status,
        totalCents: order.totalCents,
        createdAt: order.createdAt.toISOString(),
        event: {
          name: order.eventName,
          venue: order.eventVenue,
          startsAt: order.eventStartsAt.toISOString(),
        },
        seats,
      }
    }),
  )

  return c.json({ orders })
})
