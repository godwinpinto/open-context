import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type WebhooksPageComponent = typeof import("./-webhooks-page").default
const WebhooksPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as WebhooksPageComponent,
      })
    : import("./-webhooks-page"),
)

export const Route = createFileRoute("/o/$orgId/t/$teamId/webhooks/")({
  ssr: false,
  component: WebhooksRoute,
})

function WebhooksRoute() {
  const { teamId } = Route.useParams()
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <WebhooksPage teamId={teamId} />
    </Suspense>
  )
}
