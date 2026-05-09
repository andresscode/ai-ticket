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
