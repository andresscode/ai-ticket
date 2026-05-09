import { and, asc, eq, inArray, lte, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.js'
import { inventory } from '../schema.js'

export function countAvailableSeatsBySection(db: Database, eventId: string) {
  return db
    .select({
      section: inventory.section,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(inventory)
    .where(
      and(eq(inventory.eventId, eventId), eq(inventory.status, 'available')),
    )
    .groupBy(inventory.section)
}

export function suggestAvailableSeats(
  db: Database,
  args: {
    eventId: string
    count: number
    section?: 'front' | 'back' | 'balcony' | 'vip'
    maxPriceCents?: number
  },
) {
  const filters: SQL[] = [
    eq(inventory.eventId, args.eventId),
    eq(inventory.status, 'available'),
  ]
  if (args.section) filters.push(eq(inventory.section, args.section))
  if (args.maxPriceCents !== undefined)
    filters.push(lte(inventory.priceCents, args.maxPriceCents))

  return db
    .select()
    .from(inventory)
    .where(and(...filters))
    .orderBy(
      asc(inventory.priceCents),
      asc(inventory.section),
      asc(inventory.row),
      asc(inventory.seatNumber),
    )
    .limit(args.count)
}

export function findSeatsForEvent(
  db: Database,
  eventId: string,
  seatIds: string[],
) {
  return db
    .select()
    .from(inventory)
    .where(and(inArray(inventory.id, seatIds), eq(inventory.eventId, eventId)))
    .limit(seatIds.length)
}
