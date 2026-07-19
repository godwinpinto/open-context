import { useState } from "react"
import {
  ChevronsUpDown,
  Fingerprint,
  Footprints,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  UserCog,
} from "lucide-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@open-context/ui/components/avatar"
import { ChangePasswordDialog } from "@/components/change-password-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { authClient } from "@/lib/auth/client"
import { getCanCreateOrganization } from "@/lib/auth/organization"
import type { getServerSession } from "@/lib/auth/session"

type SessionUser = NonNullable<
  Awaited<ReturnType<typeof getServerSession>>
>["user"]

type OrgSummary = { id: string; name: string }
type TeamSummary = { id: string; name: string }

const navItems = [
  {
    title: "Dashboard",
    to: "/o/$orgId/t/$teamId",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Identity",
    to: "/o/$orgId/t/$teamId/identity",
    icon: Fingerprint,
    exact: false,
  },
  {
    title: "Manage",
    to: "/o/$orgId/t/$teamId/manage",
    icon: Settings,
    exact: false,
  },
] as const

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
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

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

  // Ownership is capped at one org per user — see
  // allowUserToCreateOrganization in lib/auth/index.ts for the actual
  // enforcement. This is just so the menu item isn't a dead end.
  const { data: canCreateOrganization } = useQuery({
    queryKey: ["can-create-organization"],
    queryFn: () => getCanCreateOrganization(),
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
                {canCreateOrganization !== false && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({ to: "/onboarding/organization" })
                      }
                    >
                      <Plus />
                      New organization
                    </DropdownMenuItem>
                  </>
                )}
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
                    render={
                      <Link
                        to={item.to}
                        params={{ orgId: organization.id, teamId: team.id }}
                        activeOptions={{ exact: item.exact }}
                      />
                    }
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
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/o/$orgId/t/$teamId/trail"
                      params={{ orgId: organization.id, teamId: team.id }}
                    />
                  }
                  tooltip="Trail"
                >
                  <Footprints />
                  <span>Trail</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/o/$orgId/t/$teamId/meter"
                      params={{ orgId: organization.id, teamId: team.id }}
                    />
                  }
                  tooltip="Meter"
                >
                  <Gauge />
                  <span>Meter</span>
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
                <DropdownMenuItem
                  onClick={() =>
                    navigate({
                      to: "/o/$orgId/t/$teamId/account/profile",
                      params: { orgId: organization.id, teamId: team.id },
                    })
                  }
                >
                  <UserCog />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                  <KeyRound />
                  Change password
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
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </Sidebar>
  )
}
