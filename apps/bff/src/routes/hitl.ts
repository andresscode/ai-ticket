import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  type AuthedVariables,
  requireSession,
} from '../middleware/require-session'
import { postHitlResume } from '../orchestrator/client'
import { translate } from '../stream/translate'
import type { CustomUIMessage } from '../types/ui-message'

const resumeBody = z.object({
  approved: z.boolean(),
})

export const hitlRoutes = new Hono<{ Variables: AuthedVariables }>()

hitlRoutes.use('/api/hitl/resume', requireSession)
hitlRoutes.post('/api/hitl/resume', async (c) => {
  const parsed = resumeBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400)

  const { userId, tenantId, threadId } = c.get('currentSession')

  const events = await postHitlResume({
    tenant_id: tenantId,
    user_id: userId,
    thread_id: threadId,
    approved: parsed.data.approved,
  })

  const stream = createUIMessageStream<CustomUIMessage>({
    execute: ({ writer }) => translate(events, writer),
    onError: (err) => (err instanceof Error ? err.message : String(err)),
  })

  return createUIMessageStreamResponse({ stream })
})
