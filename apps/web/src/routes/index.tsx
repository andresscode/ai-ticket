import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { TenantPanel } from '@/components/tenant-panel'
import { demoLogin, meQuery } from '@/lib/auth'
import { tenantsQuery } from '@/lib/tenants'
import { applyTenantTheme } from '@/lib/theme'
import type { TenantSummary } from '@/lib/types'

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(tenantsQuery),
})

const TAGLINES: Record<string, string> = {
  'jazz-gallery':
    'A late room of brushed cymbals, dim brass, and conversation that stays low until the bridge.',
  'empire-arts':
    'A grand house for soliloquies, hush, and the kind of bow that lasts three full beats.',
}

function LandingPage() {
  useEffect(() => {
    applyTenantTheme(null)
  }, [])

  const tenants = useQuery(tenantsQuery)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)

  const login = useMutation({
    mutationFn: (slug: string) => demoLogin(slug),
    onSuccess: (session) => {
      queryClient.setQueryData(meQuery.queryKey, session)
      applyTenantTheme(session.theme)
      navigate({ to: '/chat' })
    },
    onError: () => setPending(null),
  })

  const handleSelect = (tenant: TenantSummary) => {
    if (pending) return
    setPending(tenant.slug)
    login.mutate(tenant.slug)
  }

  const list = tenants.data ?? []

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-foreground/20"
      />
      <Header />

      <section className="flex flex-1 flex-col lg:flex-row">
        {tenants.isPending ? (
          <SkeletonPanels />
        ) : tenants.isError ? (
          <ErrorState message={String(tenants.error)} />
        ) : (
          list.map((tenant, idx) => (
            <div
              key={tenant.slug}
              className="flex flex-1 not-last:border-foreground/10 lg:not-last:border-r"
            >
              <TenantPanel
                index={idx + 1}
                tenant={tenant}
                tagline={TAGLINES[tenant.slug] ?? 'An evening, on the house.'}
                pending={pending === tenant.slug}
                disabled={pending !== null && pending !== tenant.slug}
                onSelect={() => handleSelect(tenant)}
              />
            </div>
          ))
        )}
      </section>

      <Footer />
    </main>
  )
}

function Header() {
  return (
    <header className="relative grid grid-cols-12 items-end gap-4 px-6 pt-10 pb-8 sm:px-10 sm:pt-14 lg:px-16">
      <div className="col-span-12 flex items-center justify-between gap-6 text-[10px] tracking-[0.36em] uppercase opacity-70 lg:col-span-12">
        <span>AI Ticket · Season 26 · Demo</span>
        <span className="hidden sm:inline">
          A live-event concierge in a single conversation
        </span>
        <span className="font-mono tracking-[0.18em] normal-case opacity-80">
          v0.1
        </span>
      </div>

      <div
        aria-hidden="true"
        className="col-span-12 mt-4 h-px bg-foreground/15"
      />

      <div className="col-span-12 mt-10 grid grid-cols-12 items-end gap-x-6 gap-y-6">
        <h1
          className="font-(family-name:--font-display) col-span-12 text-[clamp(3rem,9vw,7.5rem)] leading-[0.88] tracking-tight font-normal lg:col-span-9"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 30' }}
        >
          Choose your venue.
          <span
            className="font-italic mt-1 block italic opacity-90"
            style={{ fontVariationSettings: 'normal' }}
          >
            two doors, one&nbsp;conversation.
          </span>
        </h1>
        <p className="text-muted-foreground col-span-12 max-w-sm text-sm leading-relaxed lg:col-span-3 lg:justify-self-end lg:text-right">
          Pick a tenant to enter the assistant. Each room sets its own colour,
          its own catalogue of nights, and its own seats.
        </p>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="relative mt-auto flex items-center justify-between gap-6 px-6 pt-6 pb-8 text-[10px] tracking-[0.28em] uppercase opacity-60 sm:px-10 lg:px-16">
      <span>↘ Select a panel to begin</span>
      <span className="hidden sm:inline">
        Streaming via the AI SDK · MCP under the hood
      </span>
      <span className="font-mono tracking-[0.18em] normal-case">
        localhost:3000
      </span>
    </footer>
  )
}

function SkeletonPanels() {
  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="bg-muted/40 flex-1 animate-pulse not-last:border-foreground/10 lg:not-last:border-r"
        />
      ))}
    </>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <div className="max-w-md space-y-3 text-center">
        <p className="font-(family-name:--font-display) text-2xl">
          The box office is closed.
        </p>
        <p className="text-muted-foreground font-italic text-sm italic">
          {message}
        </p>
      </div>
    </div>
  )
}
