import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@open-context/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@open-context/ui/components/sidebar"
import { getServerSession } from "@/lib/auth/session"
import { getOrgTeamContext } from "@/lib/auth/organization"

export const Route = createFileRoute("/o/$orgId/t/$teamId")({
  // Auth gate only — cheap, always runs, never cached. Keeps the actual
  // org/team lookup (which hits several better-auth endpoints) out of the
  // hot path so the router's loader cache below can do its job.
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/" })
    }
    return { user: session.user }
  },
  // Org/team membership rarely changes, so this is cached by the router for
  // `staleTime` instead of re-verifying (and re-hitting
  // setActiveOrganization/setActiveTeam) on every client-side navigation.
  // A full page reload always re-runs this fresh via SSR regardless of
  // staleTime — this only smooths out in-session SPA navigation. If access
  // is revoked mid-session, the user keeps the cached "granted" result for
  // up to staleTime, which is fine here because this loader isn't the real
  // security boundary — any server function touching actual data re-checks
  // access itself via authMiddleware.
  loader: async ({ params }) => {
    const context = await getOrgTeamContext({ data: params })
    if (!context) {
      // Not a member of this org/team (or it doesn't exist) — bounce back
      // through the redirector, which will resolve one they do have access to.
      throw redirect({ to: "/dashboard" })
    }
    return context
  },
  staleTime: 5 * 60 * 1000,
  component: OrgTeamLayout,
})

function OrgTeamLayout() {
  const { user } = Route.useRouteContext()
  const { organization, team } = Route.useLoaderData()

  return (
    <SidebarProvider>
      <AppSidebar user={user} organization={organization} team={team} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
