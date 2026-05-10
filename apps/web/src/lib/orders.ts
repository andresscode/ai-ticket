import { queryOptions } from '@tanstack/react-query'
import { api } from './api'
import type { OrderSummary } from './types'

export const ordersQuery = queryOptions({
  queryKey: ['orders'] as const,
  queryFn: () =>
    api<{ orders: OrderSummary[] }>('/api/orders').then((d) => d.orders),
  staleTime: 0,
})
