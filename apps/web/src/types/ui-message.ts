import type { UIMessage } from 'ai'

export interface HitlData {
  thread_id: string
  order_id: string
  payment_id: string
  amount_cents: number
  currency: string
}

export type CustomUIMessage = UIMessage<never, { hitl: HitlData }>
