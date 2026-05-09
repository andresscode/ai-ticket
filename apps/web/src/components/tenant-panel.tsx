import { ArrowUpRight } from 'lucide-react'
import type { TenantSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TenantPanelProps {
  index: number
  tenant: TenantSummary
  pending: boolean
  disabled: boolean
  tagline: string
  onSelect: () => void
}

export function TenantPanel({
  index,
  tenant,
  pending,
  disabled,
  tagline,
  onSelect,
}: TenantPanelProps) {
  const venueLabel = tenant.venueType.toUpperCase()
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      data-pending={pending || undefined}
      className={cn(
        'group relative flex flex-1 flex-col overflow-hidden text-left',
        'p-8 sm:p-12 lg:p-16',
        'transition-[flex-grow,opacity,filter] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]',
        'data-[pending]:flex-[2.4] data-[pending]:cursor-progress',
        'disabled:opacity-30 disabled:[&:not([data-pending])]:grayscale-[0.4]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
      )}
      style={{
        backgroundColor: tenant.primaryColor,
        color: tenant.accentColor,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, currentColor 0, transparent 35%), radial-gradient(circle at 80% 90%, currentColor 0, transparent 40%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.4 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          mixBlendMode: 'overlay',
        }}
      />

      <header className="relative flex items-baseline justify-between">
        <span
          className="font-[family-name:var(--font-display)] text-[clamp(3rem,7vw,5.5rem)] leading-none font-light tabular-nums opacity-90"
          style={{
            fontVariationSettings: '"opsz" 144, "wght" 300, "SOFT" 100',
          }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <span className="text-[10px] tracking-[0.32em] uppercase opacity-60">
          {venueLabel} · ROOM {String.fromCharCode(64 + index)}
        </span>
      </header>

      <div className="relative mt-auto flex flex-col gap-8 pt-16">
        <h2
          className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,7vw,6rem)] leading-[0.9] tracking-[-0.02em] font-normal"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 400, "SOFT" 50' }}
        >
          {tenant.name}
        </h2>
        <p className="font-[family-name:var(--font-italic)] max-w-md text-[clamp(1.125rem,1.6vw,1.5rem)] leading-snug italic opacity-90">
          {tagline}
        </p>

        <div className="flex flex-wrap items-end justify-between gap-6 pt-8">
          <dl className="grid grid-cols-2 gap-x-10 gap-y-3 text-[10px] tracking-[0.28em] uppercase opacity-70">
            <div>
              <dt className="opacity-60">Venue</dt>
              <dd className="mt-1">{venueLabel}</dd>
            </div>
            <div>
              <dt className="opacity-60">Entry</dt>
              <dd className="mt-1">Conversational</dd>
            </div>
            <div>
              <dt className="opacity-60">Slug</dt>
              <dd className="mt-1 font-[family-name:var(--font-mono)] tracking-[0.18em] normal-case">
                {tenant.slug}
              </dd>
            </div>
            <div>
              <dt className="opacity-60">Status</dt>
              <dd
                className="mt-1 inline-flex items-center gap-1.5"
                aria-live="polite"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    pending ? 'animate-pulse' : 'opacity-80',
                  )}
                  style={{ backgroundColor: tenant.accentColor }}
                />
                {pending ? 'Opening doors' : 'On tonight'}
              </dd>
            </div>
          </dl>

          <span
            className={cn(
              'inline-flex items-center gap-3 self-end',
              'font-[family-name:var(--font-italic)] text-2xl italic',
              'transition-transform duration-500 group-hover:translate-x-1',
              'group-disabled:opacity-50',
            )}
          >
            {pending ? 'Entering' : 'Enter'}
            <ArrowUpRight
              className={cn(
                'size-6 transition-transform duration-500',
                'group-hover:rotate-45',
                pending && 'rotate-45 animate-pulse',
              )}
              strokeWidth={1.25}
            />
          </span>
        </div>
      </div>

      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 ring-inset ring-0',
          'transition-[box-shadow] duration-500',
          'group-hover:shadow-[inset_0_0_0_1px_currentColor]',
        )}
      />
    </button>
  )
}
