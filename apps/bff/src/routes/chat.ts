import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  type AuthedVariables,
  requireSession,
} from '../middleware/require-session'
import { postChat } from '../orchestrator/client'
import { translate } from '../stream/translate'
import type { CustomUIMessage } from '../types/ui-message'

const chatBody = z.object({
  message: z.string().min(1),
})

export const chatRoutes = new Hono<{ Variables: AuthedVariables }>()

chatRoutes.use('/api/chat', requireSession)
chatRoutes.post('/api/chat', async (c) => {
  const parsed = chatBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400)

  const { userId, tenantId, threadId } = c.get('currentSession')

  const events = await postChat({
    tenant_id: tenantId,
    user_id: userId,
    thread_id: threadId,
    message: parsed.data.message,
  })

  const stream = createUIMessageStream<CustomUIMessage>({
    execute: ({ writer }) => translate(events, writer),
    onError: (err) => (err instanceof Error ? err.message : String(err)),
  })

  return createUIMessageStreamResponse({ stream })
})
