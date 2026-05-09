import { randomUUID } from 'node:crypto'
import type { UIMessageStreamWriter } from 'ai'
import type { OrchestratorEvent } from '../types/orchestrator-sse'
import type { CustomUIMessage } from '../types/ui-message'

export async function translate(
  events: AsyncIterable<OrchestratorEvent>,
  writer: UIMessageStreamWriter<CustomUIMessage>,
): Promise<void> {
  let textId: string | null = null
  // FIFO of pending toolCallIds keyed by `${agent}::${tool}` so a result lands
  // on the right call when an agent invokes the same tool more than once.
  const pendingByKey = new Map<string, string[]>()

  const closeText = () => {
    if (textId) {
      writer.write({ type: 'text-end', id: textId })
      textId = null
    }
  }

  for await (const event of events) {
    switch (event.type) {
      case 'token': {
        if (!event.text) break
        if (!textId) {
          textId = randomUUID()
          writer.write({ type: 'text-start', id: textId })
        }
        writer.write({ type: 'text-delta', id: textId, delta: event.text })
        break
      }

      case 'tool_call': {
        closeText()
        const toolCallId = randomUUID()
        const key = `${event.agent}::${event.tool}`
        const queue = pendingByKey.get(key) ?? []
        queue.push(toolCallId)
        pendingByKey.set(key, queue)
        writer.write({
          type: 'tool-input-available',
          toolCallId,
          toolName: event.tool,
          input: event.args,
        })
        break
      }

      case 'tool_result': {
        closeText()
        const key = `${event.agent}::${event.tool}`
        const queue = pendingByKey.get(key)
        const toolCallId = queue?.shift() ?? randomUUID()
        if (queue && queue.length === 0) pendingByKey.delete(key)
        if (event.is_error) {
          writer.write({
            type: 'tool-output-error',
            toolCallId,
            errorText: stringifyResult(event.result),
          })
        } else {
          writer.write({
            type: 'tool-output-available',
            toolCallId,
            output: event.result,
          })
        }
        break
      }

      case 'hitl_required': {
        closeText()
        writer.write({
          type: 'data-hitl',
          id: event.payment_id,
          data: {
            thread_id: event.thread_id,
            order_id: event.order_id,
            payment_id: event.payment_id,
            amount_cents: event.amount_cents,
            currency: event.currency,
          },
        })
        break
      }

      case 'error': {
        closeText()
        writer.write({ type: 'error', errorText: event.message })
        break
      }

      case 'done': {
        // Final marker — close any open text block. The writer is closed by the
        // execute callback returning, not by us.
        closeText()
        break
      }
    }
  }

  closeText()
}

function stringifyResult(result: unknown): string {
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}
