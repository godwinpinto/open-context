import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type FlagsPageComponent = typeof import("./-flags-page").default
const FlagsPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as FlagsPageComponent,
      })
    : import("./-flags-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/flags/")({
  ssr: false,
  component: FlagsRoute,
})

function FlagsRoute() {
  const { teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <FlagsPage teamId={teamId} />
    </Suspense>
  )
}
