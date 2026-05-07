import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  config: text('config'), // JSON string — per-tenant feature flags / UI config
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
