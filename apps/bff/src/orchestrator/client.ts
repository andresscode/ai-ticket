import { env } from '../env'
import type {
  ChatRequest,
  HitlResumeRequest,
  OrchestratorEvent,
} from '../types/orchestrator-sse'
import { parseSse } from './sse-parser'

async function postStream(
  path: string,
  body: ChatRequest | HitlResumeRequest,
): Promise<AsyncIterable<OrchestratorEvent>> {
  const res = await fetch(`${env.orchestratorUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `orchestrator ${path} returned ${res.status}: ${text || '(no body)'}`,
    )
  }

  return parseSse(res.body)
}

export function postChat(req: ChatRequest) {
  return postStream('/chat', req)
}

export function postHitlResume(req: HitlResumeRequest) {
  return postStream('/hitl/resume', req)
}
