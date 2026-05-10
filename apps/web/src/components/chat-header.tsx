import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { logout, meQuery } from '@/lib/auth'
import { applyTenantTheme } from '@/lib/theme'
import type { SessionPayload } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  session: SessionPayload
}

export function ChatHeader({ session }: ChatHeaderProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.setQueryData(meQuery.queryKey, null)
      applyTenantTheme(null)
      navigate({ to: '/' })
    },
  })

  const venueLabel = session.theme.venueType.toUpperCase()

  return (
    <header
      className="relative flex items-center justify-between gap-6 border-b border-foreground/10 px-5 py-3 sm:px-8"
      style={{
        backgroundColor: session.theme.primaryColor,
        color: session.theme.accentColor,
      }}
    >
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[10px] tracking-[0.32em] uppercase opacity-70">
          AI Ticket
        </span>
        <span className="opacity-30">·</span>
        <h1
          className={cn(
            'font-(family-name:--font-display) text-2xl leading-none tracking-tight sm:text-3xl',
          )}
          style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 50' }}
        >
          {session.tenantName}
        </h1>
        <span className="hidden text-[10px] tracking-[0.28em] uppercase opacity-60 sm:inline">
          {venueLabel} · ROOM
        </span>
      </div>

      <div className="flex items-center gap-5">
        <span className="hidden font-mono text-[10px] tracking-[0.18em] opacity-60 md:inline">
          thread/{session.threadId.slice(0, 8)}
        </span>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 text-[10px] tracking-[0.28em] uppercase opacity-70',
            'transition-opacity hover:opacity-100 disabled:opacity-40',
            'focus-visible:outline-none focus-visible:opacity-100',
          )}
        >
          <LogOut className="size-3.5" strokeWidth={1.5} />
          Exit
        </button>
      </div>
    </header>
  )
}
