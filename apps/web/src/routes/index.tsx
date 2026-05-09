import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">AI Ticket</h1>
        <p className="text-muted-foreground mt-2">Tenant picker — Phase 3.</p>
      </div>
    </main>
  )
}
