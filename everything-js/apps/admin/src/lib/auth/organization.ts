import { createServerFn } from "@tanstack/react-start"
import { authMiddleware } from "@/lib/auth/middleware"
import { isOrgOwnerAnywhere } from "@/lib/auth/org-limits"

export const listUserOrganizations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return context.auth.api.listOrganizations({ headers: context.headers })
  })

export const getCanCreateOrganization = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const owns = await isOrgOwnerAnywhere(context.db, context.session.user.id)
    return !owns
  })

// Resolves and authorizes an org+team pair for the current user, syncing
// the session's activeOrganizationId/activeTeamId in the process. Returns
// null if the user isn't a member of either.
export const getOrgTeamContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data: { orgId: string; teamId: string }) => data)
  .handler(async ({ data, context }) => {
    const { auth, headers } = context

    const organization = await auth.api
      .setActiveOrganization({
        body: { organizationId: data.orgId },
        headers,
      })
      .catch(() => null)
    if (!organization) return null

    const teams = await auth.api.listOrganizationTeams({
      query: { organizationId: data.orgId },
      headers,
    })
    const team = teams.find((t) => t.id === data.teamId)
    if (!team) return null

    const member = await auth.api.getActiveMember({ headers })
    if (!member) return null

    // Team membership is opt-in at the plugin level, but org owners/admins
    // are expected to see every team in their org by default (teams are
    // only a hard access boundary for plain "member" roles). addTeamMember
    // is idempotent — safe to call even if they're already a member — and
    // listTeamMembers itself requires the caller to already be a member, so
    // it can't be used as a pre-check here.
    if (member.role === "owner" || member.role === "admin") {
      await auth.api
        .addTeamMember({
          body: {
            teamId: data.teamId,
            userId: member.userId,
            organizationId: data.orgId,
          },
          headers,
        })
        .catch(() => null)
    }

    const activeTeam = await auth.api
      .setActiveTeam({ body: { teamId: data.teamId }, headers })
      .catch(() => null)
    if (!activeTeam) return null

    return { organization, team, role: member.role }
  })
