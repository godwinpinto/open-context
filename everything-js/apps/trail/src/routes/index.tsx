import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: TrailLanding,
})

// Bare /trail — no team context. Real usage arrives team-scoped at
// /trail/o/:orgId/t/:teamId (linked from the admin sidebar).
function TrailLanding() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-3 p-8">
      <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
        OpenCtx Trail
      </p>
      <h1 className="text-2xl font-semibold">
        Know what your users did.
      </h1>
      <p style={{ color: "var(--muted-foreground)" }}>
        Open Trail from a team in the admin dashboard to see its events.
      </p>
      <p className="text-sm">
        <a href="/dashboard" className="underline underline-offset-4">
          Go to admin →
        </a>
      </p>
    </main>
  )
}
