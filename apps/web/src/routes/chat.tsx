import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

function ChatPage() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="text-muted-foreground mt-2">
          Auth gate + chat — Phase 4.
        </p>
      </div>
    </main>
  )
}
