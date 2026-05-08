import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const eventStatusEnum = pgEnum('event_status', [
  'active',
  'cancelled',
  'sold_out',
])

export const seatSectionEnum = pgEnum('seat_section', [
  'front',
  'back',
  'balcony',
  'vip',
])

export const seatStatusEnum = pgEnum('seat_status', [
  'available',
  'reserved',
  'sold',
])

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  config: text('config'), // JSON string — per-tenant feature flags / UI config
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    venue: text('venue').notNull(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at'),
    imageUrl: text('image_url'),
    status: eventStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // list-events: WHERE tenant_id = ? AND starts_at > NOW()
    index('events_tenant_starts_at_idx').on(t.tenantId, t.startsAt),
  ],
)

export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    section: seatSectionEnum('section').notNull(),
    row: text('row').notNull(),
    seatNumber: text('seat_number').notNull(),
    // Stored in cents to avoid floating-point precision issues (e.g. $45.00 → 4500)
    priceCents: integer('price_cents').notNull(),
    status: seatStatusEnum('status').notNull().default('available'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // check-availability / suggest-seats: WHERE event_id = ? AND status = 'available'
    index('inventory_event_status_idx').on(t.eventId, t.status),
  ],
)

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'cancelled',
])

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: text('user_id').notNull(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    status: orderStatusEnum('status').notNull().default('pending'),
    // Sum of seat prices captured at order time
    totalCents: integer('total_cents').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // get-order tenant isolation + future list-orders queries
    index('orders_tenant_idx').on(t.tenantId),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    inventoryId: uuid('inventory_id')
      .notNull()
      .references(() => inventory.id),
    // Price snapshot — preserved even if inventory price changes later
    priceCents: integer('price_cents').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // get-order: WHERE order_id = ? (fetch items for an order)
    index('order_items_order_idx').on(t.orderId),
  ],
)
