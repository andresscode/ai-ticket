import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db', () => ({ db: {} }))

vi.mock('@ai-ticket/db', () => ({
  findTenantBySlug: vi.fn(),
  listTenants: vi.fn(),
}))

import { findTenantBySlug, listTenants } from '@ai-ticket/db'
import { authRoutes } from '../src/routes/auth'
import { sessions } from '../src/session'

const mockedFindTenant = vi.mocked(findTenantBySlug)
const mockedListTenants = vi.mocked(listTenants)

function extractSessionCookie(res: Response): string {
  // Login emits two Set-Cookie headers (initial + populated session). The last
  // one is the final state — use it.
  const all = res.headers.getSetCookie()
  const last = all[all.length - 1] ?? ''
  return last.split(';')[0] ?? ''
}

function makeApp() {
  const app = new Hono()
  app.use('*', sessions)
  app.route('/', authRoutes)
  return app
}

describe('auth routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /auth/tenants returns tenants with parsed theme', async () => {
    mockedListTenants.mockResolvedValueOnce([
      {
        id: 't1',
        name: 'Jazz Gallery',
        slug: 'jazz-gallery',
        config:
          '{"primaryColor":"#1a1a2e","accentColor":"#f4c542","venueType":"jazz"}',
      },
      {
        id: 't2',
        name: 'Empire Arts',
        slug: 'empire-arts',
        config:
          '{"primaryColor":"#0f3460","accentColor":"#00c9a7","venueType":"theater"}',
      },
    ])
    const app = makeApp()
    const res = await app.request('/auth/tenants')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      tenants: Array<{
        slug: string
        name: string
        primaryColor: string
        accentColor: string
        venueType: string
      }>
    }
    expect(body.tenants).toHaveLength(2)
    expect(body.tenants[0]).toEqual({
      slug: 'jazz-gallery',
      name: 'Jazz Gallery',
      primaryColor: '#1a1a2e',
      accentColor: '#f4c542',
      venueType: 'jazz',
    })
  })

  it('rejects /auth/demo-login when body is missing tenant', async () => {
    const app = makeApp()
    const res = await app.request('/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('rejects /auth/demo-login when tenant slug is unknown', async () => {
    mockedFindTenant.mockResolvedValueOnce([])

    const app = makeApp()
    const res = await app.request('/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'nope' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'unknown tenant' })
  })

  it('logs in, sets a session cookie, returns the session payload', async () => {
    mockedFindTenant.mockResolvedValueOnce([
      {
        id: 'tenant-uuid',
        name: 'Jazz Gallery',
        slug: 'jazz-gallery',
        config:
          '{"primaryColor":"#1a1a2e","accentColor":"#f4c542","venueType":"jazz"}',
      },
    ])

    const app = makeApp()
    const res = await app.request('/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'jazz-gallery' }),
    })

    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toMatch(/aiticket_session=/)

    const body = (await res.json()) as {
      userId: string
      tenantId: string
      threadId: string
      tenantName: string
      tenantSlug: string
      theme: { primaryColor: string; accentColor: string; venueType: string }
    }
    expect(body.tenantId).toBe('tenant-uuid')
    expect(body.userId).toBe('demo-user-tenant-uuid')
    expect(body.tenantName).toBe('Jazz Gallery')
    expect(body.tenantSlug).toBe('jazz-gallery')
    expect(body.theme).toEqual({
      primaryColor: '#1a1a2e',
      accentColor: '#f4c542',
      venueType: 'jazz',
    })
    // threadId is a uuid v4
    expect(body.threadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('returns 401 from /auth/me without a cookie', async () => {
    const app = makeApp()
    const res = await app.request('/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns the session payload from /auth/me with a valid cookie', async () => {
    mockedFindTenant.mockResolvedValueOnce([
      {
        id: 'tenant-uuid',
        name: 'Jazz Gallery',
        slug: 'jazz-gallery',
        config:
          '{"primaryColor":"#1a1a2e","accentColor":"#f4c542","venueType":"jazz"}',
      },
    ])

    const app = makeApp()
    const login = await app.request('/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'jazz-gallery' }),
    })
    const cookie = extractSessionCookie(login)

    const me = await app.request('/auth/me', { headers: { cookie } })
    expect(me.status).toBe(200)
    const body = (await me.json()) as { tenantId: string; userId: string }
    expect(body.tenantId).toBe('tenant-uuid')
    expect(body.userId).toBe('demo-user-tenant-uuid')
  })
})
