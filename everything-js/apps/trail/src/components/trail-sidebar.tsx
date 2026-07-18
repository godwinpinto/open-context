import { ArrowLeft, LayoutDashboard, LogOut, UserCog } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Avatar, AvatarFallback } from "@open-context/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@open-context/ui/components/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@open-context/ui/components/sidebar"
import { authClient } from "@/lib/auth-client"

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  )
}

export function TrailSidebar({
  orgId,
  teamId,
}: {
  orgId: string
  teamId: string
}) {
  const { data: session } = authClient.useSession()
  const user = session?.user

  const { data: organizations } = authClient.useListOrganizations()
  const organization = organizations?.find((org) => org.id === orgId)

  async function onSignOut() {
    await authClient.signOut()
    window.location.href = "/"
  }

  // Cross-app destinations are plain <a> — admin is a different worker.
  const adminBase = `/o/${orgId}/t/${teamId}`

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href={adminBase} />}>
              <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
                {initials(organization?.name ?? "Trail")}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {organization?.name ?? "Workspace"}
                </span>
                <span className="truncate text-xs opacity-70">Trail</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Trail</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<a href={adminBase} />}
                  tooltip="Back to admin"
                >
                  <ArrowLeft />
                  <span>Back to admin</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/o/$orgId/t/$teamId"
                      params={{ orgId, teamId }}
                      activeOptions={{ exact: true }}
                    />
                  }
                  tooltip="Dashboard"
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="size-7 rounded-md">
                  <AvatarFallback className="rounded-md">
                    {initials(user?.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user?.name ?? "…"}
                  </span>
                  <span className="truncate text-xs opacity-70">
                    {user?.email ?? ""}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--anchor-width) min-w-56"
                align="end"
              >
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = `${adminBase}/account/profile`
                  }}
                >
                  <UserCog />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
