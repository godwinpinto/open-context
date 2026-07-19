import { createFileRoute, getRouteApi, Outlet } from "@tanstack/react-router"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

// Section navigation (Members/Teams/Roles/Connectors/API keys) lives in
// the contextual sidebar.
export const Route = createFileRoute("/o/$orgId/t/$teamId/manage")({
  component: ManageLayout,
})

function ManageLayout() {
  const { organization } = parentRoute.useLoaderData()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Manage</h1>
        <p className="text-muted-foreground text-sm">{organization.name}</p>
      </div>
      <Outlet />
    </div>
  )
}
