import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ChatHeader } from '@/components/chat-header'
import { ChatView } from '@/components/chat-view'
import { meQuery } from '@/lib/auth'
import { applyTenantTheme } from '@/lib/theme'

export const Route = createFileRoute('/chat')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const session = await queryClient.ensureQueryData(meQuery)
    if (!session) throw redirect({ to: '/' })
    return { session }
  },
  loader: ({ context }) => context.session,
  component: ChatPage,
})

function ChatPage() {
  const session = Route.useLoaderData()

  useEffect(() => {
    applyTenantTheme(session.theme)
    return () => applyTenantTheme(null)
  }, [session.theme])

  return (
    <main className="bg-background text-foreground flex h-svh flex-col overflow-hidden">
      <ChatHeader session={session} />
      <ChatView session={session} />
    </main>
  )
}
