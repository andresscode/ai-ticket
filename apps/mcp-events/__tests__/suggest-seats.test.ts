import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSeats = [
  {
    id: 's1',
    section: 'back',
    row: 'C',
    seatNumber: '12',
    priceCents: 4500,
    eventId: 'e1',
    status: 'available' as const,
  },
  {
    id: 's2',
    section: 'back',
    row: 'C',
    seatNumber: '13',
    priceCents: 4500,
    eventId: 'e1',
    status: 'available' as const,
  },
]

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi
    .fn()
    .mockResolvedValue([{ id: 'e1000000-0000-0000-0000-000000000001' }]),
}))

vi.mock('../src/db', () => ({ db: mockDb }))

vi.mock('../src/tenant-context', () => ({
  getTenantId: () => 'a0000000-0000-0000-0000-000000000001',
}))

import { suggestSeatsHandler } from '../src/tools/suggest-seats'

describe('suggest-seats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns suggested seats', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'e1000000-0000-0000-0000-000000000001' }])
      .mockResolvedValueOnce(mockSeats)

    const result = await suggestSeatsHandler({
      eventId: 'e1000000-0000-0000-0000-000000000001',
      count: 2,
    })

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text)
    expect(data).toHaveLength(2)
    expect(data[0].section).toBe('back')
    expect(data[0].priceCents).toBe(4500)
  })

  it('returns isError when event not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await suggestSeatsHandler({
      eventId: 'e1000000-0000-0000-0000-000000000099',
      count: 2,
    })

    expect(result.isError).toBe(true)
  })

  it('accepts optional section and maxPriceCents filters', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'e1000000-0000-0000-0000-000000000001' }])
      .mockResolvedValueOnce([mockSeats[0]])

    const result = await suggestSeatsHandler({
      eventId: 'e1000000-0000-0000-0000-000000000001',
      count: 1,
      section: 'back',
      maxPriceCents: 5000,
    })

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text)
    expect(data).toHaveLength(1)
  })
})
