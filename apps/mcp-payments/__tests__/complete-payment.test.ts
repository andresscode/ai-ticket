import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTransaction = vi.hoisted(() => vi.fn())

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  transaction: mockTransaction,
}))

vi.mock('../src/db.js', () => ({ db: mockDb }))

vi.mock('../src/tenant-context.js', () => ({
  getTenantId: () => 'a0000000-0000-0000-0000-000000000001',
  getUserId: () => 'u0000000-0000-0000-0000-000000000001',
}))

vi.mock('../src/stripe.js', () => ({
  confirmPaymentIntent: vi.fn(),
}))

import { confirmPaymentIntent } from '../src/stripe'
import { completePaymentHandler } from '../src/tools/complete-payment'

const mockConfirmPaymentIntent = vi.mocked(confirmPaymentIntent)

const mockPayment = {
  id: 'pp000000-0000-0000-0000-000000000001',
  orderId: 'oo000000-0000-0000-0000-000000000001',
  stripePaymentIntentId: 'pi_test_123',
  amountCents: 9000,
  currency: 'usd',
  status: 'pending' as const,
  createdAt: new Date('2026-05-07T10:00:00Z'),
}

const mockOrder = {
  id: 'oo000000-0000-0000-0000-000000000001',
  tenantId: 'a0000000-0000-0000-0000-000000000001',
  userId: 'u0000000-0000-0000-0000-000000000001',
  eventId: 'e1000000-0000-0000-0000-000000000001',
  status: 'pending' as const,
  totalCents: 9000,
  createdAt: new Date('2026-05-07T10:00:00Z'),
}

describe('complete-payment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirms stripe, runs transaction, returns confirmationNumber', async () => {
    mockDb.limit
      .mockResolvedValueOnce([mockPayment]) // fetch payment
      .mockResolvedValueOnce([mockOrder]) // fetch order
      .mockResolvedValueOnce([
        // fetch orderItems
        { inventoryId: 'ii000000-0000-0000-0000-000000000001' },
        { inventoryId: 'ii000000-0000-0000-0000-000000000002' },
      ])

    mockConfirmPaymentIntent.mockResolvedValueOnce({
      id: 'pi_test_123',
      status: 'succeeded',
    })

    mockTransaction.mockImplementation(
      async (fn: Parameters<typeof mockTransaction>[0]) => {
        const mockTx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
        }
        return fn(mockTx)
      },
    )

    const result = await completePaymentHandler({
      paymentId: 'pp000000-0000-0000-0000-000000000001',
    })

    expect(result.isError).toBeUndefined()
    const confirmation = JSON.parse(result.content[0].text)
    expect(confirmation.status).toBe('succeeded')
    expect(confirmation.confirmationNumber).toBe('PP000000')
    expect(confirmation.amountCents).toBe(9000)
    expect(mockConfirmPaymentIntent).toHaveBeenCalledWith('pi_test_123')
  })

  it('returns isError when payment not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await completePaymentHandler({
      paymentId: 'pp000000-0000-0000-0000-000000000099',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
    expect(mockConfirmPaymentIntent).not.toHaveBeenCalled()
  })

  it('returns isError when Stripe confirmation fails', async () => {
    mockDb.limit
      .mockResolvedValueOnce([mockPayment])
      .mockResolvedValueOnce([mockOrder])

    mockConfirmPaymentIntent.mockRejectedValueOnce(
      new Error('Your card was declined'),
    )

    const result = await completePaymentHandler({
      paymentId: 'pp000000-0000-0000-0000-000000000001',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Your card was declined')
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
