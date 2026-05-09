import { queryOptions } from '@tanstack/react-query'
import { api } from './api'
import type { TenantSummary } from './types'

export const tenantsQuery = queryOptions({
  queryKey: ['tenants'] as const,
  queryFn: () => api<{ tenants: TenantSummary[] }>('/auth/tenants'),
  select: (data) => data.tenants,
})
