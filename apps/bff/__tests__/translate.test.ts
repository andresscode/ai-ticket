import type { UIMessageStreamWriter } from 'ai'
import { describe, expect, it } from 'vitest'
import { translate } from '../src/stream/translate'
import type { OrchestratorEvent } from '../src/types/orchestrator-sse'
import type { CustomUIMessage } from '../src/types/ui-message'

// Chunks are typed loosely on purpose — the production code is fully typed
// against AI SDK's UIMessageChunk; these tests assert observable shape only.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type Chunk = any

function fakeWriter() {
  const chunks: Chunk[] = []
  const writer = {
    write: (chunk: Chunk) => chunks.push(chunk),
    merge: () => {},
    onError: () => '',
  }
  return {
    chunks,
    writer: writer as unknown as UIMessageStreamWriter<CustomUIMessage>,
  }
}

async function* fromArray(events: OrchestratorEvent[]) {
  for (const e of events) yield e
}

async function run(events: OrchestratorEvent[]): Promise<Chunk[]> {
  const { chunks, writer } = fakeWriter()
  await translate(fromArray(events), writer)
  return chunks
}

describe('translate', () => {
  it('opens text-start once, emits text-delta per token, closes text-end', async () => {
    const chunks = await run([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' ' },
      { type: 'token', text: 'world' },
      { type: 'done', thread_id: 't1' },
    ])

    expect(chunks.map((c) => c.type)).toEqual([
      'text-start',
      'text-delta',
      'text-delta',
      'text-delta',
      'text-end',
    ])
    const start = chunks[0] as { type: 'text-start'; id: string }
    const deltas = chunks.slice(1, 4) as {
      type: 'text-delta'
      id: string
      delta: string
    }[]
    const end = chunks[4] as { type: 'text-end'; id: string }

    // All deltas + end share the same id as start.
    expect(deltas.every((d) => d.id === start.id)).toBe(true)
    expect(end.id).toBe(start.id)
    expect(deltas.map((d) => d.delta)).toEqual(['Hello', ' ', 'world'])
  })

  it('skips empty token frames', async () => {
    const chunks = await run([
      { type: 'token', text: '' },
      { type: 'token', text: 'x' },
    ])
    expect(chunks.map((c) => c.type)).toEqual([
      'text-start',
      'text-delta',
      'text-end',
    ])
  })

  it('matches tool_call → tool_result by (agent, tool) FIFO', async () => {
    const chunks = await run([
      {
        type: 'tool_call',
        agent: 'events_agent',
        tool: 'list-events',
        args: { x: 1 },
      },
      {
        type: 'tool_result',
        agent: 'events_agent',
        tool: 'list-events',
        result: { events: [] },
        is_error: false,
      },
    ])

    const call = chunks[0] as {
      type: 'tool-input-available'
      toolCallId: string
      toolName: string
      input: unknown
    }
    const result = chunks[1] as {
      type: 'tool-output-available'
      toolCallId: string
      output: unknown
    }

    expect(call.type).toBe('tool-input-available')
    expect(result.type).toBe('tool-output-available')
    expect(call.toolName).toBe('list-events')
    expect(call.input).toEqual({ x: 1 })
    expect(result.toolCallId).toBe(call.toolCallId)
    expect(result.output).toEqual({ events: [] })
  })

  it('emits tool-output-error when is_error is true', async () => {
    const chunks = await run([
      {
        type: 'tool_call',
        agent: 'commerce_agent',
        tool: 'create-order',
        args: {},
      },
      {
        type: 'tool_result',
        agent: 'commerce_agent',
        tool: 'create-order',
        result: 'seat already sold',
        is_error: true,
      },
    ])

    const result = chunks[1] as {
      type: 'tool-output-error'
      toolCallId: string
      errorText: string
    }
    expect(result.type).toBe('tool-output-error')
    expect(result.errorText).toBe('seat already sold')
  })

  it('preserves toolCallId mapping when same (agent, tool) is called multiple times', async () => {
    const chunks = await run([
      {
        type: 'tool_call',
        agent: 'events_agent',
        tool: 'get-event',
        args: { id: 'a' },
      },
      {
        type: 'tool_call',
        agent: 'events_agent',
        tool: 'get-event',
        args: { id: 'b' },
      },
      {
        type: 'tool_result',
        agent: 'events_agent',
        tool: 'get-event',
        result: 'a-result',
        is_error: false,
      },
      {
        type: 'tool_result',
        agent: 'events_agent',
        tool: 'get-event',
        result: 'b-result',
        is_error: false,
      },
    ])

    const callA = chunks[0] as { toolCallId: string; input: { id: string } }
    const callB = chunks[1] as { toolCallId: string; input: { id: string } }
    const resultA = chunks[2] as { toolCallId: string; output: string }
    const resultB = chunks[3] as { toolCallId: string; output: string }

    expect(callA.toolCallId).not.toBe(callB.toolCallId)
    // FIFO: first call pairs with first result.
    expect(resultA.toolCallId).toBe(callA.toolCallId)
    expect(resultA.output).toBe('a-result')
    expect(resultB.toolCallId).toBe(callB.toolCallId)
    expect(resultB.output).toBe('b-result')
  })

  it('closes any open text block before emitting a non-token event', async () => {
    const chunks = await run([
      { type: 'token', text: 'thinking…' },
      {
        type: 'tool_call',
        agent: 'events_agent',
        tool: 'list-events',
        args: {},
      },
    ])

    expect(chunks.map((c) => c.type)).toEqual([
      'text-start',
      'text-delta',
      'text-end',
      'tool-input-available',
    ])
  })

  it('translates hitl_required into a data-hitl part with payment_id as id', async () => {
    const chunks = await run([
      {
        type: 'hitl_required',
        thread_id: 't1',
        order_id: 'order-9',
        payment_id: 'pay-7',
        amount_cents: 12345,
        currency: 'usd',
      },
    ])

    expect(chunks).toHaveLength(1)
    const part = chunks[0] as {
      type: 'data-hitl'
      id: string
      data: {
        thread_id: string
        order_id: string
        payment_id: string
        amount_cents: number
        currency: string
      }
    }
    expect(part.type).toBe('data-hitl')
    expect(part.id).toBe('pay-7')
    expect(part.data).toEqual({
      thread_id: 't1',
      order_id: 'order-9',
      payment_id: 'pay-7',
      amount_cents: 12345,
      currency: 'usd',
    })
  })

  it('translates error events into ai-sdk error chunks', async () => {
    const chunks = await run([{ type: 'error', message: 'boom' }])
    expect(chunks).toEqual([{ type: 'error', errorText: 'boom' }])
  })

  it('emits no part for done and closes any pending text block', async () => {
    const chunks = await run([
      { type: 'token', text: 'hi' },
      { type: 'done', thread_id: 't1' },
    ])
    expect(chunks.at(-1)?.type).toBe('text-end')
  })
})
