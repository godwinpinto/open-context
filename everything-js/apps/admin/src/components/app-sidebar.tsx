import { useState } from "react"
import {
  AppWindow,
  ArrowLeft,
  ChevronsUpDown,
  Filter,
  Fingerprint,
  Flag,
  FlaskConical,
  Footprints,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Plug,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Ticket,
  UserCog,
  Users,
  Webhook as WebhookIcon,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@open-context/ui/components/avatar"
import { ChangePasswordDialog } from "@/components/change-password-dialog"
import { DashboardsSidebarTree } from "@/components/dashboards-sidebar-tree"
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
    title: "Segmentation",
    to: "/o/$orgId/t/$teamId/segments",
    icon: Filter,
    exact: false,
  },
  {
    title: "Manage",
    to: "/o/$orgId/t/$teamId/manage",
    icon: Settings,
    exact: false,
  },
] as const

const moduleItems = [
  {
    title: "Dashboards",
    to: "/o/$orgId/t/$teamId/dashboards",
    icon: LayoutDashboard,
  },
  { title: "Trail", to: "/o/$orgId/t/$teamId/trail", icon: Footprints },
  { title: "Meter", to: "/o/$orgId/t/$teamId/meter", icon: Gauge },
  {
    title: "Experiments",
    to: "/o/$orgId/t/$teamId/experiments",
    icon: FlaskConical,
  },
  { title: "Flags", to: "/o/$orgId/t/$teamId/flags", icon: Flag },
  { title: "Webhooks", to: "/o/$orgId/t/$teamId/webhooks", icon: WebhookIcon },
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

  const location = useLocation()
  const currentTab = (location.search as { tab?: string }).tab
  const pathSection = location.pathname.split("/")[5] ?? null
  const linkParams = { orgId: organization.id, teamId: team.id }

  // Vercel/Cloudflare-style contextual sidebar: inside a section the
  // main menu is replaced by that section's menu (with a back item),
  // sliding in from the right; returning slides the main menu in from
  // the left. Header (workspace) and footer (user) stay anchored.
  type SectionItem = {
    title: string
    icon: typeof ArrowLeft
    isActive: boolean
    link: React.ReactElement
  }
  let section: {
    id: string
    title: string
    items: SectionItem[]
    // Optional custom content rendered below the items (e.g. the
    // dashboards group tree).
    extra?: React.ReactNode
  } | null = null
  if (pathSection === "trail") {
    section = {
      id: "trail",
      title: "Trail",
      items: [
        {
          title: "Dashboard",
          icon: LayoutDashboard,
          isActive: true,
          link: <Link to="/o/$orgId/t/$teamId/trail" params={linkParams} />,
        },
      ],
    }
  } else if (pathSection === "meter") {
    const tab = currentTab ?? "meters"
    section = {
      id: "meter",
      title: "Meter",
      items: [
        {
          title: "Meters",
          icon: Gauge,
          isActive: tab === "meters",
          link: (
            <Link
              to="/o/$orgId/t/$teamId/meter"
              params={linkParams}
              search={{ tab: "meters" }}
            />
          ),
        },
        {
          title: "Events",
          icon: ScrollText,
          isActive: tab === "events",
          link: (
            <Link
              to="/o/$orgId/t/$teamId/meter"
              params={linkParams}
              search={{ tab: "events" }}
            />
          ),
        },
        {
          title: "Entitlements",
          icon: Ticket,
          isActive: tab === "entitlements",
          link: (
            <Link
              to="/o/$orgId/t/$teamId/meter"
              params={linkParams}
              search={{ tab: "entitlements" }}
            />
          ),
        },
      ],
    }
  } else if (pathSection === "experiments") {
    section = {
      id: "experiments",
      title: "Experiments",
      items: [
        {
          title: "Experiments",
          icon: FlaskConical,
          isActive: true,
          link: (
            <Link to="/o/$orgId/t/$teamId/experiments" params={linkParams} />
          ),
        },
      ],
    }
  } else if (pathSection === "flags") {
    section = {
      id: "flags",
      title: "Flags",
      items: [
        {
          title: "Flags",
          icon: Flag,
          isActive: true,
          link: <Link to="/o/$orgId/t/$teamId/flags" params={linkParams} />,
        },
      ],
    }
  } else if (pathSection === "dashboards") {
    section = {
      id: "dashboards",
      title: "Dashboards",
      items: [
        {
          title: "All dashboards",
          icon: LayoutDashboard,
          isActive: location.pathname.endsWith("/dashboards"),
          link: (
            <Link to="/o/$orgId/t/$teamId/dashboards" params={linkParams} />
          ),
        },
      ],
      extra: (
        <DashboardsSidebarTree orgId={organization.id} teamId={team.id} />
      ),
    }
  } else if (pathSection === "webhooks") {
    section = {
      id: "webhooks",
      title: "Webhooks",
      items: [
        {
          title: "Webhooks",
          icon: WebhookIcon,
          isActive: true,
          link: <Link to="/o/$orgId/t/$teamId/webhooks" params={linkParams} />,
        },
      ],
    }
  } else if (pathSection === "identity") {
    const tab = currentTab ?? "identities"
    section = {
      id: "identity",
      title: "Identity",
      items: [
        {
          title: "Identities",
          icon: Fingerprint,
          isActive: tab === "identities",
          link: (
            <Link
              to="/o/$orgId/t/$teamId/identity"
              params={linkParams}
              search={{ tab: "identities" }}
            />
          ),
        },
        {
          title: "Groups",
          icon: Users,
          isActive: tab === "groups",
          link: (
            <Link
              to="/o/$orgId/t/$teamId/identity"
              params={linkParams}
              search={{ tab: "groups" }}
            />
          ),
        },
      ],
    }
  } else if (pathSection === "segments") {
    section = {
      id: "segments",
      title: "Segmentation",
      items: [
        {
          title: "Segments",
          icon: Filter,
          isActive: true,
          link: <Link to="/o/$orgId/t/$teamId/segments" params={linkParams} />,
        },
      ],
    }
  } else if (pathSection === "manage") {
    const at = (suffix: string) => location.pathname.endsWith(suffix)
    section = {
      id: "manage",
      title: "Manage",
      items: [
        {
          title: "Members",
          icon: Users,
          isActive: at("/members"),
          link: (
            <Link to="/o/$orgId/t/$teamId/manage/members" params={linkParams} />
          ),
        },
        {
          title: "Teams",
          icon: Settings,
          isActive: at("/teams"),
          link: (
            <Link to="/o/$orgId/t/$teamId/manage/teams" params={linkParams} />
          ),
        },
        {
          title: "Roles",
          icon: ShieldCheck,
          isActive: at("/roles"),
          link: (
            <Link to="/o/$orgId/t/$teamId/manage/roles" params={linkParams} />
          ),
        },
        {
          title: "Connectors",
          icon: Plug,
          isActive: at("/connectors"),
          link: (
            <Link
              to="/o/$orgId/t/$teamId/manage/connectors"
              params={linkParams}
            />
          ),
        },
        {
          title: "API keys",
          icon: KeyRound,
          isActive: at("/api-keys"),
          link: (
            <Link
              to="/o/$orgId/t/$teamId/manage/api-keys"
              params={linkParams}
            />
          ),
        },
      ],
    }
  } else if (pathSection === "account") {
    const at = (suffix: string) => location.pathname.endsWith(suffix)
    section = {
      id: "account",
      title: "Account",
      items: [
        {
          title: "Profile",
          icon: UserCog,
          isActive: at("/profile"),
          link: (
            <Link
              to="/o/$orgId/t/$teamId/account/profile"
              params={linkParams}
            />
          ),
        },
        {
          title: "Connected apps",
          icon: AppWindow,
          isActive: at("/connected-apps"),
          link: (
            <Link
              to="/o/$orgId/t/$teamId/account/connected-apps"
              params={linkParams}
            />
          ),
        },
        {
          title: "Sessions",
          icon: Monitor,
          isActive: at("/sessions"),
          link: (
            <Link
              to="/o/$orgId/t/$teamId/account/sessions"
              params={linkParams}
            />
          ),
        },
        {
          title: "Security",
          icon: ShieldCheck,
          isActive: at("/security"),
          link: (
            <Link
              to="/o/$orgId/t/$teamId/account/security"
              params={linkParams}
            />
          ),
        },
      ],
    }
  }

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
                <ChevronsUpDown className="ml-auto opacity-50" />
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
      <SidebarContent className="overflow-x-hidden">
        {section ? (
          <div
            key={section.id}
            className="animate-in fade-in slide-in-from-right-8 duration-200"
          >
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/o/$orgId/t/$teamId"
                          params={{ orgId: organization.id, teamId: team.id }}
                        />
                      }
                      tooltip="Main menu"
                    >
                      <ArrowLeft />
                      <span>Main menu</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={item.isActive}
                        render={item.link}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
                {section.extra ?? null}
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        ) : (
          <div
            key="main"
            className="animate-in fade-in slide-in-from-left-8 duration-200"
          >
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
                  {moduleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        render={
                          <Link
                            to={item.to}
                            params={{ orgId: organization.id, teamId: team.id }}
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
          </div>
        )}
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
