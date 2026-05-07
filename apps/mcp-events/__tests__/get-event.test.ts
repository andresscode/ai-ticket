import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([
    {
      id: 'e1000000-0000-0000-0000-000000000001',
      name: 'Miles Ahead Quartet',
      description: 'An evening of cool jazz',
      venue: 'Jazz Gallery Main Stage',
      startsAt: new Date('2026-05-09T20:00:00Z'),
      endsAt: null,
      imageUrl: null,
      status: 'active' as const,
    },
  ]),
}))

vi.mock('../src/db.js', () => ({ db: mockDb }))

vi.mock('../src/tenant-context.js', () => ({
  getTenantId: () => 'a0000000-0000-0000-0000-000000000001',
}))

import { getEventHandler } from '../src/tools/get-event'

describe('get-event', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns event detail when found', async () => {
    const result = await getEventHandler({
      eventId: 'e1000000-0000-0000-0000-000000000001',
    })

    expect(result.isError).toBeUndefined()
    const event = JSON.parse(result.content[0].text)
    expect(event.name).toBe('Miles Ahead Quartet')
    expect(event.startsAt).toBe('2026-05-09T20:00:00.000Z')
    expect(event.endsAt).toBeNull()
  })

  it('returns isError when event not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getEventHandler({
      eventId: 'e1000000-0000-0000-0000-000000000099',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })
})
