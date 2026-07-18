import { createFileRoute } from "@tanstack/react-router"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"

export const Route = createFileRoute("/o/$orgId/t/$teamId/")({
  component: TrailDashboard,
})

function TrailDashboard() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Trail</h1>
        <p className="text-muted-foreground text-sm">
          Know what your users did.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>No events yet</CardTitle>
          <CardDescription>
            Event tracking lands here next — served by the open-context-trail
            worker, sharing admin's session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            This page is a separate TanStack Start deployment mounted at
            /trail on the shared hostname.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
