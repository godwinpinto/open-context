import { createFileRoute, getRouteApi, Link, Outlet, useLocation } from "@tanstack/react-router"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const parentRoute = getRouteApi("/o/$orgId/t/$teamId")

const TABS = [
  { value: "members", label: "Members" },
  { value: "teams", label: "Teams" },
  { value: "roles", label: "Roles" },
] as const

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage")({
  component: ManageLayout,
})

function ManageLayout() {
  const { organization, team } = parentRoute.useLoaderData()
  const { pathname } = useLocation()
  const activeTab =
    TABS.find((tab) => pathname.endsWith(`/${tab.value}`))?.value ?? "members"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Manage</h1>
        <p className="text-muted-foreground text-sm">{organization.name}</p>
      </div>

      <Tabs value={activeTab}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              render={
                <Link
                  to={`/o/$orgId/t/$teamId/manage/${tab.value}`}
                  params={{ orgId: organization.id, teamId: team.id }}
                />
              }
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  )
}
