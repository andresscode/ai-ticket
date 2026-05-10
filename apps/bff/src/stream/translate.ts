import { randomUUID } from 'node:crypto'
import type { UIMessageStreamWriter } from 'ai'
import type { OrchestratorEvent } from '../types/orchestrator-sse'
import type { CustomUIMessage } from '../types/ui-message'

export async function translate(
  events: AsyncIterable<OrchestratorEvent>,
  writer: UIMessageStreamWriter<CustomUIMessage>,
): Promise<void> {
  let textId: string | null = null
  const seenInputs = new Set<string>()

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
        const toolCallId = event.tool_call_id || randomUUID()
        seenInputs.add(toolCallId)
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
        const toolCallId = event.tool_call_id
        if (!toolCallId || !seenInputs.has(toolCallId)) break
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
