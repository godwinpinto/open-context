import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type DashboardViewComponent = typeof import("./-dashboard-view").default
const DashboardView = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as DashboardViewComponent,
      })
    : import("./-dashboard-view"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/dashboards/$dashboardId/")({
  ssr: false,
  component: DashboardViewRoute,
})

function DashboardViewRoute() {
  const { teamId, dashboardId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <DashboardView teamId={teamId} dashboardId={dashboardId} />
    </Suspense>
  )
}
