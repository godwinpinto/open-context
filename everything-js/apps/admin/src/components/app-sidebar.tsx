import { ChevronsUpDown, LayoutDashboard, LogOut, Plus } from "lucide-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth/client"
import type { getServerSession } from "@/lib/auth/session"

type SessionUser = NonNullable<
  Awaited<ReturnType<typeof getServerSession>>
>["user"]

type OrgSummary = { id: string; name: string }
type TeamSummary = { id: string; name: string }

const navItems = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
]

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

export function AppSidebar({
  user,
  organization,
  team,
}: {
  user: SessionUser
  organization: OrgSummary
  team: TeamSummary
}) {
  const navigate = useNavigate()

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await authClient.organization.list()
      if (error) throw error
      return data
    },
  })

  const { data: teams } = useQuery({
    queryKey: ["organization-teams", organization.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listTeams({
        query: { organizationId: organization.id },
      })
      if (error) throw error
      return data
    },
  })

  async function onSignOut() {
    await authClient.signOut()
    await navigate({ to: "/" })
  }

  async function switchTeam(teamId: string) {
    if (teamId === team.id) return
    await navigate({
      to: "/o/$orgId/t/$teamId",
      params: { orgId: organization.id, teamId },
    })
  }

  async function switchOrganization(orgId: string) {
    if (orgId === organization.id) return
    // /dashboard resolves the target org's active (or first) team for us.
    await authClient.organization.setActive({ organizationId: orgId })
    await navigate({ to: "/dashboard" })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
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
                <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
                  {initials(organization.name)}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {organization.name}
                  </span>
                  <span className="truncate text-xs opacity-70">
                    {team.name}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--anchor-width) min-w-56"
                align="start"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    Teams in {organization.name}
                  </DropdownMenuLabel>
                  {(teams ?? [team]).map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => switchTeam(t.id)}
                    >
                      {t.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                  {(organizations ?? [organization]).map((o) => (
                    <DropdownMenuItem
                      key={o.id}
                      onClick={() => switchOrganization(o.id)}
                    >
                      {o.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    navigate({ to: "/onboarding/organization" })
                  }
                >
                  <Plus />
                  New organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs opacity-70">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--anchor-width) min-w-56"
                align="end"
              >
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
