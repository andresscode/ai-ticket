import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Database } from '../client.js'
import { events, inventory, orderItems, orders } from '../schema.js'

export function getOrdersForUser(
  db: Database,
  userId: string,
  tenantId: string,
) {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      eventName: events.name,
      eventVenue: events.venue,
      eventStartsAt: events.startsAt,
    })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .where(and(eq(orders.userId, userId), eq(orders.tenantId, tenantId)))
    .orderBy(desc(orders.createdAt))
}

export function getOrderForTenant(
  db: Database,
  orderId: string,
  tenantId: string,
) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1)
}

export function getOrderItemsWithSeats(db: Database, orderId: string) {
  return db
    .select({
      inventoryId: orderItems.inventoryId,
      priceCents: orderItems.priceCents,
      section: inventory.section,
      row: inventory.row,
      seatNumber: inventory.seatNumber,
    })
    .from(orderItems)
    .innerJoin(inventory, eq(orderItems.inventoryId, inventory.id))
    .where(eq(orderItems.orderId, orderId))
}

export function getOrderItemInventoryIds(db: Database, orderId: string) {
  return db
    .select({ inventoryId: orderItems.inventoryId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .limit(100)
}

export function createOrderTx(
  db: Database,
  args: {
    tenantId: string
    userId: string
    eventId: string
    totalCents: number
    seats: { id: string; priceCents: number }[]
  },
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        tenantId: args.tenantId,
        userId: args.userId,
        eventId: args.eventId,
        totalCents: args.totalCents,
      })
      .returning()

    if (!order) throw new Error('Insert returned no rows')

    await tx.insert(orderItems).values(
      args.seats.map((s) => ({
        orderId: order.id,
        inventoryId: s.id,
        priceCents: s.priceCents,
      })),
    )

    await tx
      .update(inventory)
      .set({ status: 'reserved' })
      .where(
        inArray(
          inventory.id,
          args.seats.map((s) => s.id),
        ),
      )

    return order
  })
}
