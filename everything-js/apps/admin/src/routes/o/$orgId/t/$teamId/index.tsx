import { createFileRoute, getRouteApi } from "@tanstack/react-router"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

export const Route = createFileRoute("/o/$orgId/t/$teamId/")({
  component: DashboardHome,
})

function DashboardHome() {
  const { user } = parentRoute.useRouteContext()
  const { organization, team } = parentRoute.useLoaderData()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome, {user.name}</CardTitle>
        <CardDescription>
          {organization.name} / {team.name}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
