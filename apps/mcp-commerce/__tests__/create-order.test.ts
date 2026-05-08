import { beforeEach, describe, expect, it, vi } from 'vitest'

const EVENT_ID = 'e1000000-0000-0000-0000-000000000001'
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001'
const USER_ID = 'u1000000-0000-0000-0000-000000000001'
const ORDER_ID = 'f0000000-0000-0000-0000-000000000001'

const SEAT_ID_1 = 's1000000-0000-0000-0000-000000000001'
const SEAT_ID_2 = 's1000000-0000-0000-0000-000000000002'

const mockSeats = [
  {
    id: SEAT_ID_1,
    eventId: EVENT_ID,
    section: 'back' as const,
    row: 'C',
    seatNumber: '12',
    priceCents: 4500,
    status: 'available' as const,
    createdAt: new Date(),
  },
  {
    id: SEAT_ID_2,
    eventId: EVENT_ID,
    section: 'back' as const,
    row: 'C',
    seatNumber: '13',
    priceCents: 4500,
    status: 'available' as const,
    createdAt: new Date(),
  },
]

const mockOrder = {
  id: ORDER_ID,
  tenantId: TENANT_ID,
  userId: USER_ID,
  eventId: EVENT_ID,
  status: 'pending' as const,
  totalCents: 9000,
  createdAt: new Date('2026-05-07T10:00:00Z'),
}

const mockTx = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([mockOrder]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
}

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../src/db.js', () => ({ db: mockDb }))

vi.mock('../src/tenant-context.js', () => ({
  getTenantId: () => TENANT_ID,
  getUserId: () => USER_ID,
}))

import { createOrderHandler } from '../src/tools/create-order'

describe('create-order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockTx.insert.mockReturnValue(mockTx)
    mockTx.values.mockReturnValue(mockTx)
    mockTx.returning.mockResolvedValue([mockOrder])
    mockTx.update.mockReturnValue(mockTx)
    mockTx.set.mockReturnValue(mockTx)
    mockTx.where.mockResolvedValue(undefined)
    mockDb.transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    )
  })

  it('creates an order and reserves seats', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: EVENT_ID }])
      .mockResolvedValueOnce(mockSeats)

    const result = await createOrderHandler({
      eventId: EVENT_ID,
      seatIds: [SEAT_ID_1, SEAT_ID_2],
    })

    expect(result.isError).toBeUndefined()
    const order = JSON.parse(result.content[0].text)
    expect(order.id).toBe(ORDER_ID)
    expect(order.totalCents).toBe(9000)
    expect(order.items).toHaveLength(2)
    expect(order.status).toBe('pending')
  })

  it('returns isError when event not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await createOrderHandler({
      eventId: 'e1000000-0000-0000-0000-000000000099',
      seatIds: [SEAT_ID_1],
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })

  it('returns isError with "not found" when seat ID does not exist', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: EVENT_ID }])
      // Only one seat returned — the other ID doesn't exist in DB
      .mockResolvedValueOnce([mockSeats[0]])

    const unknownId = 's9999999-0000-0000-0000-000000000099'
    const result = await createOrderHandler({
      eventId: EVENT_ID,
      seatIds: [SEAT_ID_1, unknownId],
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
    expect(result.content[0].text).toContain(unknownId)
  })

  it('returns isError with "already reserved" when seat is reserved', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: EVENT_ID }])
      .mockResolvedValueOnce([{ ...mockSeats[0], status: 'reserved' as const }])

    const result = await createOrderHandler({
      eventId: EVENT_ID,
      seatIds: [SEAT_ID_1],
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('already reserved')
    expect(result.content[0].text).toContain(SEAT_ID_1)
  })

  it('returns isError with "already sold" when seat is sold', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: EVENT_ID }])
      .mockResolvedValueOnce([{ ...mockSeats[0], status: 'sold' as const }])

    const result = await createOrderHandler({
      eventId: EVENT_ID,
      seatIds: [SEAT_ID_1],
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('already sold')
    expect(result.content[0].text).toContain(SEAT_ID_1)
  })

  it('combines multiple error reasons in one message', async () => {
    const reservedSeat = { ...mockSeats[0], status: 'reserved' as const }
    const soldSeat = { ...mockSeats[1], status: 'sold' as const }
    const unknownId = 's9999999-0000-0000-0000-000000000099'

    mockDb.limit
      .mockResolvedValueOnce([{ id: EVENT_ID }])
      // reserved + sold returned, unknown not returned at all
      .mockResolvedValueOnce([reservedSeat, soldSeat])

    const result = await createOrderHandler({
      eventId: EVENT_ID,
      seatIds: [SEAT_ID_1, SEAT_ID_2, unknownId],
    })

    expect(result.isError).toBe(true)
    const text = result.content[0].text
    expect(text).toContain('not found')
    expect(text).toContain('already reserved')
    expect(text).toContain('already sold')
  })
})
