import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
}))

vi.mock('../src/db.js', () => ({ db: mockDb }))

vi.mock('../src/tenant-context.js', () => ({
  getTenantId: () => 'a0000000-0000-0000-0000-000000000001',
  getUserId: () => 'u0000000-0000-0000-0000-000000000001',
}))

vi.mock('../src/stripe.js', () => ({
  createPaymentIntent: vi.fn(),
}))

import { createPaymentIntent } from '../src/stripe'
import { initPaymentHandler } from '../src/tools/init-payment'

const mockCreatePaymentIntent = vi.mocked(createPaymentIntent)

const mockOrder = {
  id: 'oo000000-0000-0000-0000-000000000001',
  tenantId: 'a0000000-0000-0000-0000-000000000001',
  userId: 'u0000000-0000-0000-0000-000000000001',
  eventId: 'e1000000-0000-0000-0000-000000000001',
  status: 'pending' as const,
  totalCents: 9000,
  createdAt: new Date('2026-05-07T10:00:00Z'),
}

const mockPaymentRow = {
  id: 'pp000000-0000-0000-0000-000000000001',
  orderId: 'oo000000-0000-0000-0000-000000000001',
  stripePaymentIntentId: 'pi_test_123',
  amountCents: 9000,
  currency: 'usd',
  status: 'pending' as const,
  createdAt: new Date('2026-05-07T10:00:00Z'),
}

describe('init-payment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a payment intent and returns paymentId', async () => {
    mockDb.limit.mockResolvedValueOnce([mockOrder])
    mockCreatePaymentIntent.mockResolvedValueOnce({
      id: 'pi_test_123',
      status: 'requires_confirmation',
    })
    mockDb.returning.mockResolvedValueOnce([mockPaymentRow])

    const result = await initPaymentHandler({
      orderId: 'oo000000-0000-0000-0000-000000000001',
    })

    expect(result.isError).toBeUndefined()
    const payment = JSON.parse(result.content[0].text)
    expect(payment.paymentId).toBe('pp000000-0000-0000-0000-000000000001')
    expect(payment.stripePaymentIntentId).toBe('pi_test_123')
    expect(payment.amountCents).toBe(9000)
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(9000, 'usd')
  })

  it('returns isError when order not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await initPaymentHandler({
      orderId: 'oo000000-0000-0000-0000-000000000099',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it('returns isError when order is not pending', async () => {
    mockDb.limit.mockResolvedValueOnce([{ ...mockOrder, status: 'confirmed' }])

    const result = await initPaymentHandler({
      orderId: 'oo000000-0000-0000-0000-000000000001',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not pending')
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })
})
