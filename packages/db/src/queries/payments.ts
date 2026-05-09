import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../client.js'
import { inventory, orders, payments } from '../schema.js'

export function findPaymentById(db: Database, paymentId: string) {
  return db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
}

export function insertPayment(
  db: Database,
  args: {
    orderId: string
    stripePaymentIntentId: string
    amountCents: number
    currency: string
  },
) {
  return db
    .insert(payments)
    .values({
      orderId: args.orderId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      amountCents: args.amountCents,
      currency: args.currency,
      status: 'pending',
    })
    .returning()
}

export function completePaymentTx(
  db: Database,
  args: {
    paymentId: string
    orderId: string
    inventoryIds: string[]
  },
) {
  return db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: 'succeeded' })
      .where(eq(payments.id, args.paymentId))

    await tx
      .update(orders)
      .set({ status: 'confirmed' })
      .where(eq(orders.id, args.orderId))

    if (args.inventoryIds.length > 0) {
      await tx
        .update(inventory)
        .set({ status: 'sold' })
        .where(inArray(inventory.id, args.inventoryIds))
    }

    return true
  })
}
