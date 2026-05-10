// Mirror of apps/orchestrator/src/models/api.py — kept in sync manually.

export interface TokenEvent {
  type: 'token'
  text: string
}

export interface ToolCallEvent {
  type: 'tool_call'
  agent: string
  tool: string
  tool_call_id: string
  args: Record<string, unknown>
}

export interface ToolResultEvent {
  type: 'tool_result'
  agent: string
  tool: string
  tool_call_id: string
  result: unknown
  is_error: boolean
}

export interface HitlRequiredEvent {
  type: 'hitl_required'
  thread_id: string
  order_id: string
  payment_id: string
  amount_cents: number
  currency: string
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export interface DoneEvent {
  type: 'done'
  thread_id: string
}

export type OrchestratorEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | HitlRequiredEvent
  | ErrorEvent
  | DoneEvent

export interface ChatRequest {
  tenant_id: string
  user_id: string
  thread_id: string
  message: string
}

export interface HitlResumeRequest {
  tenant_id: string
  user_id: string
  thread_id: string
  approved: boolean
}
