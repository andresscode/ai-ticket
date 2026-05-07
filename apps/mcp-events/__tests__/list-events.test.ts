import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([
      {
        id: 'e1000000-0000-0000-0000-000000000001',
        name: 'Miles Ahead Quartet',
        description: 'An evening of cool jazz',
        venue: 'Jazz Gallery Main Stage',
        startsAt: new Date('2026-05-09T20:00:00Z'),
        endsAt: new Date('2026-05-09T23:00:00Z'),
        imageUrl: null,
        status: 'active',
      },
    ]),
  },
}))

vi.mock('../src/tenant-context', () => ({
  getTenantId: () => 'a0000000-0000-0000-0000-000000000001',
}))

import { listEventsHandler } from '../src/tools/list-events'

describe('list-events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns upcoming active events as JSON', async () => {
    const result = await listEventsHandler()

    expect(result.content[0].type).toBe('text')

    const events = JSON.parse(result.content[0].text)
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('Miles Ahead Quartet')
    expect(events[0].startsAt).toBe('2026-05-09T20:00:00.000Z')
  })

  it('includes structuredContent with events array', async () => {
    const result = await listEventsHandler()
    expect(result.structuredContent.events).toHaveLength(1)
  })
})
