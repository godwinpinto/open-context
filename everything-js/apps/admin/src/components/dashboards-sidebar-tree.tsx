import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation } from "@tanstack/react-router"
import { ChevronRight, Folder, LayoutDashboard } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@open-context/ui/components/sidebar"
import { dashboardsClient } from "@/lib/modules/dashboards-client"

// The team's dashboards in the contextual sidebar: ungrouped ones as
// flat entries, grouped ones under one-level collapsible folders
// (groupName on the dashboard row).
export function DashboardsSidebarTree({
  orgId,
  teamId,
}: {
  orgId: string
  teamId: string
}) {
  const location = useLocation()
  const dashboardsQuery = useQuery({
    queryKey: ["dashboards", teamId],
    queryFn: () => dashboardsClient.listDashboards({ teamId }),
  })
  const dashboards = dashboardsQuery.data?.dashboards ?? []
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const ungrouped = dashboards.filter((dashboard) => !dashboard.groupName)
  const groups = new Map<string, typeof dashboards>()
  for (const dashboard of dashboards) {
    if (!dashboard.groupName) continue
    const list = groups.get(dashboard.groupName) ?? []
    list.push(dashboard)
    groups.set(dashboard.groupName, list)
  }

  const isActive = (id: string) => location.pathname.endsWith(`/dashboards/${id}`)

  const entry = (dashboard: { id: string; name: string }, sub = false) => {
    const link = (
      <Link
        to="/o/$orgId/t/$teamId/dashboards/$dashboardId"
        params={{ orgId, teamId, dashboardId: dashboard.id }}
      />
    )
    return sub ? (
      <SidebarMenuSubItem key={dashboard.id}>
        <SidebarMenuSubButton isActive={isActive(dashboard.id)} render={link}>
          <span>{dashboard.name}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    ) : (
      <SidebarMenuItem key={dashboard.id}>
        <SidebarMenuButton
          isActive={isActive(dashboard.id)}
          render={link}
          tooltip={dashboard.name}
        >
          <LayoutDashboard />
          <span>{dashboard.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenu>
      {ungrouped.map((dashboard) => entry(dashboard))}
      {[...groups.entries()].map(([groupName, members]) => {
        const open = openGroups[groupName] ?? true
        return (
          <SidebarMenuItem key={groupName}>
            <SidebarMenuButton
              tooltip={groupName}
              onClick={() =>
                setOpenGroups((current) => ({ ...current, [groupName]: !open }))
              }
            >
              <Folder />
              <span>{groupName}</span>
              <ChevronRight
                className={`ml-auto transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              />
            </SidebarMenuButton>
            {open ? (
              <SidebarMenuSub>
                {members.map((dashboard) => entry(dashboard, true))}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
