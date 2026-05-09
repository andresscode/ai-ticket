import type { OrchestratorEvent } from '../types/orchestrator-sse'

const KNOWN_TYPES = new Set([
  'token',
  'tool_call',
  'tool_result',
  'hitl_required',
  'error',
  'done',
])

export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<OrchestratorEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Frames are delimited by a blank line (\n\n). Process every complete frame
      // currently in the buffer; leave any partial trailing frame for the next read.
      while (true) {
        const sep = buffer.indexOf('\n\n')
        if (sep === -1) break
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const event = parseFrame(frame)
        if (event) yield event
      }
    }
    // Flush a trailing frame missing its terminator (defensive — orchestrator
    // always emits the final \n\n but stream truncation shouldn't crash us).
    if (buffer.trim()) {
      const event = parseFrame(buffer)
      if (event) yield event
    }
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(frame: string): OrchestratorEvent | null {
  // SSE frames may contain multiple `data:` lines that concatenate. Orchestrator
  // emits a single line per frame, but spec-compliant parsers concat.
  const dataLines: string[] = []
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''))
    }
  }
  if (dataLines.length === 0) return null

  const payload = dataLines.join('\n')
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('type' in parsed) ||
    typeof (parsed as { type: unknown }).type !== 'string' ||
    !KNOWN_TYPES.has((parsed as { type: string }).type)
  ) {
    return null
  }

  return parsed as OrchestratorEvent
}
