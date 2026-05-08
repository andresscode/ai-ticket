import { beforeEach, describe, expect, it, vi } from 'vitest'

const EVENT_ID = 'e1000000-0000-0000-0000-000000000001'
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001'
const USER_ID = 'u1000000-0000-0000-0000-000000000001'
const ORDER_ID = 'f0000000-0000-0000-0000-000000000001'

const mockOrderRow = {
  id: ORDER_ID,
  tenantId: TENANT_ID,
  userId: USER_ID,
  eventId: EVENT_ID,
  status: 'pending' as const,
  totalCents: 9000,
  createdAt: new Date('2026-05-07T10:00:00Z'),
}

const mockItems = [
  {
    inventoryId: 's1000000-0000-0000-0000-000000000001',
    priceCents: 4500,
    section: 'back' as const,
    row: 'C',
    seatNumber: '12',
  },
  {
    inventoryId: 's1000000-0000-0000-0000-000000000002',
    priceCents: 4500,
    section: 'back' as const,
    row: 'C',
    seatNumber: '13',
  },
]

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  limit: vi.fn(),
}))

vi.mock('../src/db.js', () => ({ db: mockDb }))

vi.mock('../src/tenant-context.js', () => ({
  getTenantId: () => TENANT_ID,
  getUserId: () => USER_ID,
}))

import { getOrderHandler } from '../src/tools/get-order'

describe('get-order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
  })

  it('returns order with items when found', async () => {
    mockDb.limit.mockResolvedValueOnce([mockOrderRow])
    mockDb.where.mockReturnValueOnce(mockDb).mockResolvedValueOnce(mockItems)

    const result = await getOrderHandler({ orderId: ORDER_ID })

    expect(result.isError).toBeUndefined()
    const order = JSON.parse(result.content[0].text)
    expect(order.id).toBe(ORDER_ID)
    expect(order.totalCents).toBe(9000)
    expect(order.createdAt).toBe('2026-05-07T10:00:00.000Z')
    expect(order.items).toHaveLength(2)
    expect(order.items[0].section).toBe('back')
  })

  it('returns isError when order not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getOrderHandler({ orderId: ORDER_ID })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })
})
