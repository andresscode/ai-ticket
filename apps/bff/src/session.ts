import { CookieStore, type Session, sessionMiddleware } from 'hono-sessions'
import { env } from './env'

export interface SessionPayload {
  userId: string
  tenantId: string
  threadId: string
}

export type AppSession = Session<SessionPayload>

export type SessionVariables = {
  session: AppSession
  session_key_rotation: boolean
}

const ONE_DAY_SECONDS = 60 * 60 * 24

export const sessions = sessionMiddleware({
  store: new CookieStore(),
  encryptionKey: env.sessionSecret,
  expireAfterSeconds: ONE_DAY_SECONDS,
  sessionCookieName: 'aiticket_session',
  cookieOptions: {
    sameSite: 'Lax',
    path: '/',
    httpOnly: true,
  },
})

export function readSession(session: AppSession): SessionPayload | null {
  const userId = session.get('userId')
  const tenantId = session.get('tenantId')
  const threadId = session.get('threadId')
  if (!userId || !tenantId || !threadId) return null
  return { userId, tenantId, threadId }
}

export function writeSession(
  session: AppSession,
  payload: SessionPayload,
): void {
  session.set('userId', payload.userId)
  session.set('tenantId', payload.tenantId)
  session.set('threadId', payload.threadId)
}
