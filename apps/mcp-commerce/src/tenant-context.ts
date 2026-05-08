import { AsyncLocalStorage } from 'node:async_hooks'

export interface TenantContext {
  tenantId: string
  userId: string
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

export function getTenantId(): string {
  const ctx = tenantStorage.getStore()
  if (!ctx) throw new Error('No tenant context — called outside of a request')
  return ctx.tenantId
}

export function getUserId(): string {
  const ctx = tenantStorage.getStore()
  if (!ctx) throw new Error('No tenant context — called outside of a request')
  return ctx.userId
}
