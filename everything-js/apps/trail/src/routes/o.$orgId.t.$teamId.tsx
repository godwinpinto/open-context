import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/o/$orgId/t/$teamId")({
  component: TeamTrail,
})

type SessionUser = { name: string; email: string }

// Same-origin call to admin's better-auth endpoint — the session
// cookie is scoped to the shared hostname, so it just flows.
function useSharedSession() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)
  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => setUser(session?.user ?? null))
      .catch(() => setUser(null))
  }, [])
  return user
}

function TeamTrail() {
  const { orgId, teamId } = Route.useParams()
  const user = useSharedSession()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-3 p-8">
      <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
        OpenCtx Trail
      </p>
      <h1 className="text-2xl font-semibold">Team activity</h1>
      <dl
        className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border p-4 text-sm"
        style={{ borderColor: "var(--border)" }}
      >
        <dt style={{ color: "var(--muted-foreground)" }}>Served by</dt>
        <dd className="font-mono">open-context-trail worker</dd>
        <dt style={{ color: "var(--muted-foreground)" }}>Organization</dt>
        <dd className="font-mono">{orgId}</dd>
        <dt style={{ color: "var(--muted-foreground)" }}>Team</dt>
        <dd className="font-mono">{teamId}</dd>
        <dt style={{ color: "var(--muted-foreground)" }}>Signed in as</dt>
        <dd>
          {user === undefined
            ? "checking session…"
            : user === null
              ? "not signed in"
              : `${user.name} <${user.email}> (shared session ✓)`}
        </dd>
      </dl>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        Event tracking lands here next.
      </p>
      <p className="text-sm">
        <a
          href={`/o/${orgId}/t/${teamId}`}
          className="underline underline-offset-4"
        >
          ← Back to admin dashboard
        </a>
      </p>
    </main>
  )
}
