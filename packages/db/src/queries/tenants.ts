import { eq } from 'drizzle-orm'
import type { Database } from '../client.js'
import { tenants } from '../schema.js'

export function findTenantBySlug(db: Database, slug: string) {
  return db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)
}
