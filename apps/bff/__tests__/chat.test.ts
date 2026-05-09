import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db', () => ({ db: {} }))

vi.mock('@ai-ticket/db', () => ({
  findTenantBySlug: vi.fn(),
}))

import { findTenantBySlug } from '@ai-ticket/db'
import { authRoutes } from '../src/routes/auth'
import { chatRoutes } from '../src/routes/chat'
import { sessions } from '../src/session'

const mockedFindTenant = vi.mocked(findTenantBySlug)

function makeApp() {
  const app = new Hono()
  app.use('*', sessions)
  app.route('/', authRoutes)
  app.route('/', chatRoutes)
  return app
}

function sseStream(events: object[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const e of events) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      controller.close()
    },
  })
}

async function readAll(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let out = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    out += dec.decode(value, { stream: true })
  }
  return out
}

async function loginCookie(app: Hono): Promise<string> {
  mockedFindTenant.mockResolvedValueOnce([
    { id: 'tenant-uuid', name: 'Jazz Gallery', slug: 'jazz-gallery' },
  ])
  const res = await app.request('/auth/demo-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenant: 'jazz-gallery' }),
  })
  // Login emits two Set-Cookie headers (initial empty session + populated one).
  // Use the last — it carries the actual session payload.
  const all = res.headers.getSetCookie()
  return (all[all.length - 1] ?? '').split(';')[0] ?? ''
}

describe('POST /api/chat', () => {
  // biome-ignore lint/suspicious/noExplicitAny: vitest's spyOn return type is awkward here
  let fetchSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns 401 without a session cookie', async () => {
    const app = makeApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects when message is missing', async () => {
    const app = makeApp()
    const cookie = await loginCookie(app)
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('forwards tenant_id/user_id/thread_id from session, not from body', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(sseStream([{ type: 'done', thread_id: 'ignored' }]), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const app = makeApp()
    const cookie = await loginCookie(app)
    await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'hello',
        // These attempts to spoof must be ignored — the route reads from session.
        tenant_id: 'attacker',
        user_id: 'attacker',
        thread_id: 'attacker',
      }),
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://orchestrator.test/chat')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as {
      tenant_id: string
      user_id: string
      thread_id: string
      message: string
    }
    expect(body.tenant_id).toBe('tenant-uuid')
    expect(body.user_id).toBe('demo-user-tenant-uuid')
    expect(body.message).toBe('hello')
    expect(body.tenant_id).not.toBe('attacker')
    expect(body.thread_id).not.toBe('attacker')
  })

  it('translates orchestrator SSE into AI SDK UI Message Stream parts', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        sseStream([
          { type: 'token', text: 'Hello' },
          { type: 'token', text: ' world' },
          {
            type: 'tool_call',
            agent: 'events_agent',
            tool: 'list-events',
            args: {},
          },
          {
            type: 'tool_result',
            agent: 'events_agent',
            tool: 'list-events',
            result: { events: [] },
            is_error: false,
          },
          { type: 'done', thread_id: 't1' },
        ]),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    )

    const app = makeApp()
    const cookie = await loginCookie(app)
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'hi' }),
    })

    expect(res.status).toBe(200)
    const body = await readAll(res)
    expect(body).toContain('"type":"text-start"')
    expect(body).toContain('"type":"text-delta"')
    expect(body).toContain('"delta":"Hello"')
    expect(body).toContain('"delta":" world"')
    expect(body).toContain('"type":"text-end"')
    expect(body).toContain('"type":"tool-input-available"')
    expect(body).toContain('"toolName":"list-events"')
    expect(body).toContain('"type":"tool-output-available"')
  })

  it('translates hitl_required into a data-hitl part', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        sseStream([
          {
            type: 'hitl_required',
            thread_id: 't1',
            order_id: 'order-9',
            payment_id: 'pay-7',
            amount_cents: 12345,
            currency: 'usd',
          },
          { type: 'done', thread_id: 't1' },
        ]),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    )

    const app = makeApp()
    const cookie = await loginCookie(app)
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'pay' }),
    })

    const body = await readAll(res)
    expect(body).toContain('"type":"data-hitl"')
    expect(body).toContain('"payment_id":"pay-7"')
    expect(body).toContain('"amount_cents":12345')
  })
})
