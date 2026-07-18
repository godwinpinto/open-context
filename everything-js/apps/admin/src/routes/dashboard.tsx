import { createFileRoute, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { env } from "cloudflare:workers"

import { createAuth } from "@/lib/auth"
import { getServerSession } from "@/lib/auth/session"
import { listUserOrganizations } from "@/lib/auth/organization"

const resolveDefaultDestination = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = new Headers(getRequestHeaders() as HeadersInit)
    const session = await getServerSession()
    if (!session) return { to: "/" as const }

    const organizations = await listUserOrganizations()
    if (organizations.length === 0) {
      return { to: "/onboarding/organization" as const }
    }

    const activeOrgId = session.session.activeOrganizationId
    const organization =
      organizations.find((o) => o.id === activeOrgId) ?? organizations[0]

    const auth = createAuth(env)
    const teams = await auth.api.listOrganizationTeams({
      query: { organizationId: organization.id },
      headers,
    })
    if (teams.length === 0) {
      return { to: "/onboarding/organization" as const }
    }

    const activeTeamId = session.session.activeTeamId
    const team = teams.find((t) => t.id === activeTeamId) ?? teams[0]

    return {
      to: "/o/$orgId/t/$teamId" as const,
      params: { orgId: organization.id, teamId: team.id },
    }
  },
)

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const destination = await resolveDefaultDestination()
    throw redirect(destination)
  },
})
