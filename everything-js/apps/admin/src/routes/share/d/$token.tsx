import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Skeleton } from "@open-context/ui/components/skeleton"

// Thin shell — page body excluded from the server bundle via the
// SSR-guarded lazy import (ARCHITECTURE.md / TanStack router#6400).
type SharePageComponent = typeof import("./-share-page").default
const SharePage = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({
        default: (() => null) as unknown as SharePageComponent,
      })
    : import("./-share-page"),
)

export const Route = createFileRoute("/share/d/$token")({
  ssr: false,
  component: ShareRoute,
})

function ShareRoute() {
  const { token } = Route.useParams()
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-8">
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <SharePage token={token} />
    </Suspense>
  )
}
