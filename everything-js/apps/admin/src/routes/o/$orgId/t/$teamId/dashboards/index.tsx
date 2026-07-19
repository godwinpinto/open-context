import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type DashboardsPageComponent = typeof import("./-dashboards-page").default
const DashboardsPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as DashboardsPageComponent,
      })
    : import("./-dashboards-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/dashboards/")({
  ssr: false,
  component: DashboardsRoute,
})

function DashboardsRoute() {
  const { orgId, teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <DashboardsPage orgId={orgId} teamId={teamId} />
    </Suspense>
  )
}
