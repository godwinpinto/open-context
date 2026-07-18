import { Outlet, createFileRoute } from "@tanstack/react-router"

import { Separator } from "@open-context/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@open-context/ui/components/sidebar"
import { TrailSidebar } from "@/components/trail-sidebar"

export const Route = createFileRoute("/o/$orgId/t/$teamId")({
  component: TeamTrailLayout,
})

function TeamTrailLayout() {
  const { orgId, teamId } = Route.useParams()

  return (
    <SidebarProvider>
      <TrailSidebar orgId={orgId} teamId={teamId} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">Trail</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
