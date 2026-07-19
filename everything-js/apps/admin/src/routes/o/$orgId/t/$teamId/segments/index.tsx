import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type SegmentsPageComponent = typeof import("./-segments-page").default
const SegmentsPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as SegmentsPageComponent,
      })
    : import("./-segments-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/segments/")({
  ssr: false,
  component: SegmentsRoute,
})

function SegmentsRoute() {
  const { teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <SegmentsPage teamId={teamId} />
    </Suspense>
  )
}
