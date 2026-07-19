import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Module UIs are client-rendered (ssr: false) AND their component body
// is excluded from the server bundle: `import.meta.env.SSR` is replaced
// at build time, so the dynamic import below is dead-code-eliminated
// from the server build. Only this thin shell (~1 KB) lands server-side
// — heavy client-only deps (charts, editors) never bloat the worker.
// See TanStack/router#6400 for why ssr:false alone doesn't do this.
type TrailPageComponent = typeof import("./-trail-page").default
const TrailPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({ default: (() => null) as unknown as TrailPageComponent })
    : import("./-trail-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/trail/")({
  ssr: false,
  component: TrailRoute,
})

function TrailRoute() {
  const { teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <TrailPage teamId={teamId} />
    </Suspense>
  )
}
