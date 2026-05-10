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

  it('uses orchestrator-supplied tool_call_id as the AI SDK toolCallId', async () => {
    const chunks = await run([
      {
        type: 'tool_call',
        agent: 'events_agent',
        tool: 'list-events',
        tool_call_id: 'tc-abc',
        args: { x: 1 },
      },
      {
        type: 'tool_result',
        agent: 'events_agent',
        tool: 'list-events',
        tool_call_id: 'tc-abc',
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
    expect(call.toolCallId).toBe('tc-abc')
    expect(result.toolCallId).toBe('tc-abc')
    expect(call.toolName).toBe('list-events')
    expect(call.input).toEqual({ x: 1 })
    expect(result.output).toEqual({ events: [] })
  })

  it('emits tool-output-error when is_error is true', async () => {
    const chunks = await run([
      {
        type: 'tool_call',
        agent: 'commerce_agent',
        tool: 'create-order',
        tool_call_id: 'tc-1',
        args: {},
      },
      {
        type: 'tool_result',
        agent: 'commerce_agent',
        tool: 'create-order',
        tool_call_id: 'tc-1',
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

  it('matches calls + results across LangGraph node boundaries via tool_call_id', async () => {
    const chunks = await run([
      {
        type: 'tool_call',
        agent: 'supervisor',
        tool: 'transfer_to_events_agent',
        tool_call_id: 'tc-xfer',
        args: {},
      },
      {
        type: 'tool_result',
        agent: 'events_agent',
        tool: 'transfer_to_events_agent',
        tool_call_id: 'tc-xfer',
        result: 'ok',
        is_error: false,
      },
    ])

    expect(chunks[0]?.toolCallId).toBe('tc-xfer')
    expect(chunks[1]?.toolCallId).toBe('tc-xfer')
  })

  it('drops tool_result events with no matching tool_call', async () => {
    const chunks = await run([
      {
        type: 'tool_result',
        agent: 'whatever',
        tool: 'orphan',
        tool_call_id: 'tc-missing',
        result: 'should be ignored',
        is_error: false,
      },
    ])
    expect(chunks).toEqual([])
  })

  it('closes any open text block before emitting a non-token event', async () => {
    const chunks = await run([
      { type: 'token', text: 'thinking…' },
      {
        type: 'tool_call',
        agent: 'events_agent',
        tool: 'list-events',
        tool_call_id: 'tc-1',
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
