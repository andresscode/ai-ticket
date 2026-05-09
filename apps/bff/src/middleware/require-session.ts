import { createMiddleware } from 'hono/factory'
import {
  readSession,
  type SessionPayload,
  type SessionVariables,
} from '../session'

export type AuthedVariables = SessionVariables & {
  currentSession: SessionPayload
}

export const requireSession = createMiddleware<{ Variables: AuthedVariables }>(
  async (c, next) => {
    const payload = readSession(c.get('session'))
    if (!payload) return c.json({ error: 'unauthorized' }, 401)
    c.set('currentSession', payload)
    await next()
  },
)
