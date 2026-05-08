import 'dotenv/config'

if (!process.env.STRIPE_MOCK_URL) {
  throw new Error('STRIPE_MOCK_URL not set')
}

const BASE_URL = process.env.STRIPE_MOCK_URL

async function stripePost(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer sk_test_dummy',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = data?.error as Record<string, unknown> | undefined
    throw new Error(String(err?.message ?? `Stripe HTTP ${res.status}`))
  }
  return data
}

export async function createPaymentIntent(
  amountCents: number,
  currency: string,
): Promise<{ id: string; status: string }> {
  const data = await stripePost('/payment_intents', {
    amount: String(amountCents),
    currency,
    'payment_method_types[]': 'card',
  })
  return data as { id: string; status: string }
}

export async function confirmPaymentIntent(
  intentId: string,
): Promise<{ id: string; status: string }> {
  const data = await stripePost(`/payment_intents/${intentId}/confirm`, {
    payment_method: 'pm_card_visa',
  })
  return data as { id: string; status: string }
}
