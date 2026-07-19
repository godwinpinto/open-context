import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type ExperimentsPageComponent = typeof import("./-experiments-page").default
const ExperimentsPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as ExperimentsPageComponent,
      })
    : import("./-experiments-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/experiments/")({
  ssr: false,
  component: ExperimentsRoute,
})

function ExperimentsRoute() {
  const { teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <ExperimentsPage teamId={teamId} />
    </Suspense>
  )
}
