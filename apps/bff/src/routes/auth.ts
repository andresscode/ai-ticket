import { randomUUID } from 'node:crypto'
import { findTenantBySlug, listTenants } from '@ai-ticket/db'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import {
  readSession,
  type SessionVariables,
  type TenantTheme,
  writeSession,
} from '../session'

const loginBody = z.object({
  tenant: z.string().min(1),
})

const tenantConfigSchema = z.object({
  primaryColor: z.string(),
  accentColor: z.string(),
  venueType: z.string(),
})

function parseTheme(config: string | null): TenantTheme {
  const fallback: TenantTheme = {
    primaryColor: '#0f172a',
    accentColor: '#6366f1',
    venueType: 'venue',
  }
  if (!config) return fallback
  try {
    const parsed = tenantConfigSchema.safeParse(JSON.parse(config))
    return parsed.success ? parsed.data : fallback
  } catch {
    return fallback
  }
}

export const authRoutes = new Hono<{ Variables: SessionVariables }>()

authRoutes.get('/auth/tenants', async (c) => {
  const rows = await listTenants(db)
  const tenants = rows.map((t) => ({
    slug: t.slug,
    name: t.name,
    ...parseTheme(t.config),
  }))
  return c.json({ tenants })
})

authRoutes.post('/auth/demo-login', async (c) => {
  const parsed = loginBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400)

  const [tenant] = await findTenantBySlug(db, parsed.data.tenant)

  if (!tenant) return c.json({ error: 'unknown tenant' }, 400)

  const theme = parseTheme(tenant.config)
  const payload = {
    userId: `demo-user-${tenant.id}`,
    tenantId: tenant.id,
    threadId: randomUUID(),
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    theme,
  }
  writeSession(c.get('session'), payload)

  return c.json(payload)
})

authRoutes.get('/auth/me', (c) => {
  const payload = readSession(c.get('session'))
  if (!payload) return c.json({ error: 'unauthorized' }, 401)
  return c.json(payload)
})

authRoutes.post('/auth/logout', (c) => {
  c.get('session').deleteSession()
  return c.json({ ok: true })
})
