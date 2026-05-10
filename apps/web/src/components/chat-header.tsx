import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Ticket } from 'lucide-react'
import { useState } from 'react'
import { logout, meQuery } from '@/lib/auth'
import { ordersQuery } from '@/lib/orders'
import { applyTenantTheme } from '@/lib/theme'
import type { OrderSummary, SessionPayload } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

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
      queryClient.removeQueries({ queryKey: ordersQuery.queryKey })
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
        <MyTicketsDialog />
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

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400' },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-500/15 text-emerald-400',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-foreground/10 text-foreground/40',
  },
}

function OrderCard({ order }: { order: OrderSummary }) {
  const status = statusConfig[order.status]
  return (
    <div className="rounded-sm border border-foreground/10 bg-foreground/2 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-(family-name:--font-display) truncate text-lg leading-tight"
            style={{
              fontVariationSettings: '"opsz" 144, "wght" 360, "SOFT" 50',
            }}
          >
            {order.event.name}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest opacity-50">
            {order.event.venue} · {formatDate(order.event.startsAt)}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-widest uppercase',
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="border-t border-foreground/8 pt-2.5">
        <div className="space-y-1">
          {order.seats.map((seat) => (
            <div
              key={seat.inventoryId}
              className="flex items-center justify-between gap-4"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">
                {seat.section} · Row {seat.row} · Seat {seat.seatNumber}
              </span>
              <span className="font-mono text-[10px] tabular-nums opacity-70">
                {formatPrice(seat.priceCents)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-foreground/8 pt-2.5">
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-40">
            {order.seats.length} {order.seats.length === 1 ? 'seat' : 'seats'}
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase opacity-80">
            Total{' '}
            <span className="tabular-nums">
              {formatPrice(order.totalCents)}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

function OrderCardSkeleton() {
  return (
    <div className="animate-pulse rounded-sm border border-foreground/10 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-foreground/10" />
          <div className="h-2.5 w-28 rounded bg-foreground/6" />
        </div>
        <div className="h-4 w-16 rounded-full bg-foreground/8" />
      </div>
      <div className="border-t border-foreground/8 pt-2.5 space-y-1.5">
        <div className="flex justify-between">
          <div className="h-2.5 w-36 rounded bg-foreground/8" />
          <div className="h-2.5 w-10 rounded bg-foreground/8" />
        </div>
        <div className="flex justify-between">
          <div className="h-2.5 w-32 rounded bg-foreground/6" />
          <div className="h-2.5 w-10 rounded bg-foreground/6" />
        </div>
      </div>
    </div>
  )
}

function MyTicketsDialog() {
  const [open, setOpen] = useState(false)
  const { data: orders, isLoading } = useQuery({
    ...ordersQuery,
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 text-[10px] tracking-[0.28em] uppercase opacity-70',
            'transition-opacity hover:opacity-100 disabled:opacity-40',
            'focus-visible:outline-none focus-visible:opacity-100',
          )}
        >
          <Ticket className="size-3.5" strokeWidth={1.5} />
          My Tickets
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs tracking-[0.28em] uppercase">
            My Tickets
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] -mx-1 px-1">
          {isLoading ? (
            <div className="space-y-3">
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-40">
                No orders yet
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-[10px] tracking-widest uppercase"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
