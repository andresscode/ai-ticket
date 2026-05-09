import type { TenantTheme } from './types'

export function applyTenantTheme(theme: TenantTheme | null): void {
  const root = document.documentElement
  if (!theme) {
    root.style.removeProperty('--tenant-primary')
    root.style.removeProperty('--tenant-accent')
    return
  }
  root.style.setProperty('--tenant-primary', theme.primaryColor)
  root.style.setProperty('--tenant-accent', theme.accentColor)
}
