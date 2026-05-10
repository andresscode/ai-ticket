export interface TenantTheme {
  primaryColor: string
  accentColor: string
  venueType: string
}

export interface TenantSummary extends TenantTheme {
  slug: string
  name: string
}

export interface SessionPayload {
  userId: string
  tenantId: string
  threadId: string
  tenantSlug: string
  tenantName: string
  theme: TenantTheme
}

export interface OrderSeat {
  inventoryId: string
  section: string
  row: string
  seatNumber: string
  priceCents: number
}

export interface OrderSummary {
  id: string
  status: 'pending' | 'confirmed' | 'cancelled'
  totalCents: number
  createdAt: string
  event: { name: string; venue: string; startsAt: string }
  seats: OrderSeat[]
}
