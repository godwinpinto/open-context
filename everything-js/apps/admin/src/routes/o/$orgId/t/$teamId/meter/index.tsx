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
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "meters" | "events" | "entitlements" } => ({
    ...(search.tab === "meters" ||
    search.tab === "events" ||
    search.tab === "entitlements"
      ? { tab: search.tab }
      : {}),
  }),
  component: MeterRoute,
})

function MeterRoute() {
  const { teamId } = Route.useParams()
  const { tab } = Route.useSearch()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <MeterPage teamId={teamId} tab={tab ?? "meters"} />
    </Suspense>
  )
}
