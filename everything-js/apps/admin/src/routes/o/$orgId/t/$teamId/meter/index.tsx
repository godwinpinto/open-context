import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — the page body is excluded from the server bundle via the
// SSR-guarded lazy import (see ARCHITECTURE.md / TanStack router#6400).
type MeterPageComponent = typeof import("./-meter-page").default
const MeterPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as MeterPageComponent,
      })
    : import("./-meter-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/meter/")({
  ssr: false,
  component: MeterRoute,
})

function MeterRoute() {
  const { teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <MeterPage teamId={teamId} />
    </Suspense>
  )
}
