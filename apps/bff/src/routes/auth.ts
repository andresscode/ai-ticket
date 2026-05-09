import { randomUUID } from 'node:crypto'
import { findTenantBySlug } from '@ai-ticket/db'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { readSession, type SessionVariables, writeSession } from '../session'

const loginBody = z.object({
  tenant: z.string().min(1),
})

export const authRoutes = new Hono<{ Variables: SessionVariables }>()

authRoutes.post('/auth/demo-login', async (c) => {
  const parsed = loginBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400)

  const [tenant] = await findTenantBySlug(db, parsed.data.tenant)

  if (!tenant) return c.json({ error: 'unknown tenant' }, 400)

  const payload = {
    userId: `demo-user-${tenant.id}`,
    tenantId: tenant.id,
    threadId: randomUUID(),
  }
  writeSession(c.get('session'), payload)

  return c.json({
    userId: payload.userId,
    tenantId: payload.tenantId,
    threadId: payload.threadId,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
  })
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
