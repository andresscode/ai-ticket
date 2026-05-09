import { describe, expect, it } from 'vitest'
import { parseSse } from '../src/orchestrator/sse-parser'
import type { OrchestratorEvent } from '../src/types/orchestrator-sse'

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: OrchestratorEvent[] = []
  for await (const e of parseSse(stream)) out.push(e)
  return out
}

const tok = (text: string) =>
  `data: ${JSON.stringify({ type: 'token', text })}\n\n`

describe('parseSse', () => {
  it('parses one frame per chunk', async () => {
    const events = await collect(streamFromChunks([tok('a'), tok('b')]))
    expect(events).toEqual([
      { type: 'token', text: 'a' },
      { type: 'token', text: 'b' },
    ])
  })

  it('reassembles frames split across chunk boundaries', async () => {
    const full = tok('hello world')
    const mid = Math.floor(full.length / 2)
    const events = await collect(
      streamFromChunks([full.slice(0, mid), full.slice(mid)]),
    )
    expect(events).toEqual([{ type: 'token', text: 'hello world' }])
  })

  it('handles a single chunk containing multiple complete frames', async () => {
    const events = await collect(
      streamFromChunks([tok('a') + tok('b') + tok('c')]),
    )
    expect(events.map((e) => (e as { text: string }).text)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('skips frames whose JSON fails to parse and continues', async () => {
    const bad = 'data: {not json\n\n'
    const events = await collect(streamFromChunks([tok('a'), bad, tok('b')]))
    expect(events.map((e) => (e as { text: string }).text)).toEqual(['a', 'b'])
  })

  it('skips events with unknown type', async () => {
    const unknown = `data: ${JSON.stringify({ type: 'mystery', x: 1 })}\n\n`
    const events = await collect(
      streamFromChunks([tok('a'), unknown, tok('b')]),
    )
    expect(events.map((e) => (e as { text: string }).text)).toEqual(['a', 'b'])
  })

  it('flushes a trailing frame missing the terminating blank line', async () => {
    // No trailing \n\n on the second frame.
    const events = await collect(
      streamFromChunks([tok('a'), 'data: {"type":"done","thread_id":"t1"}']),
    )
    expect(events).toEqual([
      { type: 'token', text: 'a' },
      { type: 'done', thread_id: 't1' },
    ])
  })

  it('parses every orchestrator event variant', async () => {
    const variants: OrchestratorEvent[] = [
      { type: 'token', text: 'x' },
      {
        type: 'tool_call',
        agent: 'a',
        tool: 't',
        args: { k: 1 },
      },
      {
        type: 'tool_result',
        agent: 'a',
        tool: 't',
        result: { ok: true },
        is_error: false,
      },
      {
        type: 'hitl_required',
        thread_id: 't1',
        order_id: 'o',
        payment_id: 'p',
        amount_cents: 1,
        currency: 'usd',
      },
      { type: 'error', message: 'boom' },
      { type: 'done', thread_id: 't1' },
    ]
    const wire = variants.map((v) => `data: ${JSON.stringify(v)}\n\n`).join('')
    const events = await collect(streamFromChunks([wire]))
    expect(events).toEqual(variants)
  })
})
