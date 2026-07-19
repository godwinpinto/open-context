import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type IdentityPageComponent = typeof import("./-identity-page").default
const IdentityPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as IdentityPageComponent,
      })
    : import("./-identity-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/identity/")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { key?: string; tab?: "identities" | "groups" } => ({
    ...(typeof search.key === "string" ? { key: search.key } : {}),
    ...(search.tab === "groups" || search.tab === "identities"
      ? { tab: search.tab }
      : {}),
  }),
  component: IdentityRoute,
})

function IdentityRoute() {
  const { teamId } = Route.useParams()
  const { key, tab } = Route.useSearch()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <IdentityPage
        teamId={teamId}
        initialKey={key}
        tab={tab ?? "identities"}
      />
    </Suspense>
  )
}
