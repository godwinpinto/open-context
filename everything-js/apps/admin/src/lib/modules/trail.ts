import { ORPCError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { and, eq } from "drizzle-orm"
import {
  trailAdminRouter,
  trailConsumerRouter,
  type TrailAdminContext,
  type TrailConsumerContext,
} from "@open-context/module-trail"

import * as schema from "../db/schema"
import { createAuth } from "../auth"
import { getDb } from "../auth/middleware"

// Host-side mounting for the Trail module. The host owns ALL
// authentication — modules receive an authenticated context and never
// see cookies or API keys.

// Admin surface: session cookie → user, and an assertTeamAccess the
// module must call with the teamId it was given.
const adminHandler = new RPCHandler(trailAdminRouter)

export async function handleTrailAdmin(request: Request, env: Env) {
  const auth = createAuth(env)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getDb(env)
  const context: TrailAdminContext = {
    db,
    userId: session.user.id,
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
                eq(schema.member.userId, session.user.id),
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

  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/trail/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

// Consumer surface: x-api-key → team scope (from the key's metadata,
// set at key creation). The URL can never vary the scope.
const consumerHandler = new OpenAPIHandler(trailConsumerRouter)

export async function handleTrailConsumer(request: Request, env: Env) {
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

  const context: TrailConsumerContext = {
    db: getDb(env),
    teamId,
  }

  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/trail/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
