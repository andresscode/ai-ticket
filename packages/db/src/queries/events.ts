import { and, eq, gt } from 'drizzle-orm'
import type { Database } from '../client.js'
import { events } from '../schema.js'

export function listUpcomingEventsForTenant(db: Database, tenantId: string) {
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        eq(events.status, 'active'),
        gt(events.startsAt, new Date()),
      ),
    )
    .orderBy(events.startsAt)
}

export function getEventForTenant(
  db: Database,
  eventId: string,
  tenantId: string,
) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
    .limit(1)
}

export function findEventIdForTenant(
  db: Database,
  eventId: string,
  tenantId: string,
) {
  return db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
    .limit(1)
}
