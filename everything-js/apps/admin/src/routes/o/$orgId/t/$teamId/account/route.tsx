import { createFileRoute, getRouteApi, Outlet } from "@tanstack/react-router"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

// Section navigation (Profile/Connected apps/Sessions/Security) lives
// in the contextual sidebar.
export const Route = createFileRoute("/o/$orgId/t/$teamId/account")({
  component: AccountLayout,
})

function AccountLayout() {
  const { organization } = parentRoute.useLoaderData()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Account settings</h1>
        <p className="text-muted-foreground text-sm">
          Your personal account, not specific to {organization.name}
        </p>
      </div>
      <Outlet />
    </div>
  )
}
