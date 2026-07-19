import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type PortalPageComponent = typeof import("./-portal-page").default
const PortalPage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as PortalPageComponent,
      })
    : import("./-portal-page"),
)

export const Route = createFileRoute("/portal/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    ...(typeof search.token === "string" ? { token: search.token } : {}),
  }),
  component: PortalRoute,
})

function PortalRoute() {
  const { token } = Route.useSearch()
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl p-8">
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PortalPage token={token} />
    </Suspense>
  )
}
