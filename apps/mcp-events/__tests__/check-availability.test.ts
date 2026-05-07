import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEventRow = { id: 'e1000000-0000-0000-0000-000000000001' }
const mockSectionCounts = [
  { section: 'front', count: 5 },
  { section: 'back', count: 10 },
  { section: 'vip', count: 2 },
]

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi
    .fn()
    .mockResolvedValue([{ id: 'e1000000-0000-0000-0000-000000000001' }]),
  groupBy: vi.fn().mockResolvedValue([
    { section: 'front', count: 5 },
    { section: 'back', count: 10 },
    { section: 'vip', count: 2 },
  ]),
}))

vi.mock('../src/db.js', () => ({ db: mockDb }))

vi.mock('../src/tenant-context.js', () => ({
  getTenantId: () => 'a0000000-0000-0000-0000-000000000001',
}))

import { checkAvailabilityHandler } from '../src/tools/check-availability'

describe('check-availability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns section counts and total', async () => {
    mockDb.limit.mockResolvedValueOnce([mockEventRow])
    mockDb.groupBy.mockResolvedValueOnce(mockSectionCounts)

    const result = await checkAvailabilityHandler({
      eventId: 'e1000000-0000-0000-0000-000000000001',
    })

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text)
    expect(data.total).toBe(17)
    expect(data.bySection.front).toBe(5)
    expect(data.bySection.back).toBe(10)
    expect(data.bySection.vip).toBe(2)
  })

  it('returns isError when event not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await checkAvailabilityHandler({
      eventId: 'e1000000-0000-0000-0000-000000000099',
    })

    expect(result.isError).toBe(true)
  })
})
