import { queryOptions } from '@tanstack/react-query'
import { ApiError, api } from './api'
import type { SessionPayload } from './types'

export const meQuery = queryOptions({
  queryKey: ['auth', 'me'] as const,
  queryFn: async () => {
    try {
      return await api<SessionPayload>('/auth/me')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null
      throw err
    }
  },
  staleTime: 60_000,
  retry: false,
})

export function demoLogin(tenant: string): Promise<SessionPayload> {
  return api<SessionPayload>('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ tenant }),
  })
}

export function logout(): Promise<{ ok: true }> {
  return api<{ ok: true }>('/auth/logout', { method: 'POST' })
}
