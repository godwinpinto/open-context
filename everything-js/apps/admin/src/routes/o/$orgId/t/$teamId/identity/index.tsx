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
  validateSearch: (search: Record<string, unknown>) => ({
    key: typeof search.key === "string" ? search.key : undefined,
  }),
  component: IdentityRoute,
})

function IdentityRoute() {
  const { teamId } = Route.useParams()
  const { key } = Route.useSearch()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <IdentityPage teamId={teamId} initialKey={key} />
    </Suspense>
  )
}
