import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import * as schema from "../db/schema"
import { createAuth } from "../auth"
import { getDb } from "../auth/middleware"

// Shared host-side glue for module mounting. The host owns ALL
// authentication — modules receive an authenticated context and never
// see cookies or API keys.

export type AdminCallContext = {
  db: ReturnType<typeof getDb>
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
}

// Session-authenticated (admin surface). Returns a Response on failure
// so route handlers can early-return it.
export async function adminCallContext(
  request: Request,
  env: Env,
): Promise<AdminCallContext | Response> {
  const auth = createAuth(env)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const db = getDb(env)
  const userId = session.user.id
  return {
    db,
    userId,
    assertTeamAccess: async (teamId) => {
      const [team] = await db
        .select({ organizationId: schema.team.organizationId })
        .from(schema.team)
        .where(eq(schema.team.id, teamId))
      const [membership] = team
        ? await db
            .select({ id: schema.member.id })
            .from(schema.member)
            .where(
              and(
                eq(schema.member.organizationId, team.organizationId),
                eq(schema.member.userId, userId),
              ),
            )
        : []
      if (!membership) {
        throw new ORPCError("FORBIDDEN", {
          message: "Not a member of this team",
        })
      }
    },
  }
}

export type ConsumerCallContext = {
  db: ReturnType<typeof getDb>
  teamId: string
}

// API-key-authenticated (consumer surface). Team scope comes from the
// key's metadata, set at key creation — never from the request.
export async function consumerCallContext(
  request: Request,
  env: Env,
): Promise<ConsumerCallContext | Response> {
  const key = request.headers.get("x-api-key")
  if (!key) {
    return Response.json(
      { error: "Missing x-api-key header" },
      { status: 401 },
    )
  }
  const auth = createAuth(env)
  const { valid, key: apiKey } = await auth.api.verifyApiKey({
    body: { key },
  })
  const teamId = (apiKey?.metadata as { teamId?: string } | null)?.teamId
  if (!valid || !teamId) {
    return Response.json(
      { error: "Invalid API key or key not scoped to a team" },
      { status: 401 },
    )
  }
  return { db: getDb(env), teamId }
}
