import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { call } from "@orpc/server"
import { z } from "zod"
import {
  getMergedProperties,
  identityInSegments,
  segmentsAdminRouter,
} from "@open-context/core"
import { trailAdminRouter } from "@open-context/module-trail"
import {
  createD1EventStore,
  meterAdminRouter,
} from "@open-context/module-meter"
import { experimentsAdminRouter } from "@open-context/module-experiments"
import { flagsAdminRouter } from "@open-context/module-flags"

import {
  getDb,
  listUserTeams,
  makeAssertTeamAccess,
  type AuthedUser,
  type Env,
} from "./auth"

// Tools bridge MCP → the same module procedures the admin UI calls
// (oRPC `call` with a host-constructed context) — zero duplicated
// business logic, same team-membership guard as everywhere.
//
// v1 note: Meter reads use the D1 store; teams with a ClickHouse
// connector configured should query usage via the dashboard until the
// connector lookup is shared with this host.

function text(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  }
}

export function buildServer(env: Env, user: AuthedUser): McpServer {
  const db = getDb(env)
  const assertTeamAccess = makeAssertTeamAccess(db, user.userId)
  const adminCtx = { db, userId: user.userId, assertTeamAccess }

  const server = new McpServer({
    name: "open-context",
    version: "1.0.0",
  })

  server.registerTool(
    "list_teams",
    {
      description:
        "List the teams you belong to. Call this first — every other tool needs a teamId from here.",
      inputSchema: {},
    },
    async () => text(await listUserTeams(db, user.userId)),
  )

  server.registerTool(
    "identity_get",
    {
      description:
        "Look up an identity (an end-user/account in the team's product): merged properties (group props under identity props) and segment memberships.",
      inputSchema: {
        teamId: z.string(),
        key: z.string().describe("The identity key, e.g. user-42"),
      },
    },
    async ({ teamId, key }) => {
      await assertTeamAccess(teamId)
      const [merged, segments] = await Promise.all([
        getMergedProperties(db, teamId, key),
        identityInSegments(db, teamId, key),
      ])
      return text({ ...merged, segments })
    },
  )

  server.registerTool(
    "segments_list",
    {
      description: "List the team's segments (dynamic rules and manual lists).",
      inputSchema: { teamId: z.string() },
    },
    async ({ teamId }) =>
      text(
        await call(
          segmentsAdminRouter.listSegments,
          { teamId },
          { context: adminCtx },
        ),
      ),
  )

  server.registerTool(
    "trail_events",
    {
      description:
        "Recent behavior events (Trail). Optionally filter by the identity key (distinctId).",
      inputSchema: {
        teamId: z.string(),
        limit: z.number().int().min(1).max(100).default(25),
      },
    },
    async ({ teamId, limit }) =>
      text(
        await call(
          trailAdminRouter.listEvents,
          { teamId, limit },
          { context: adminCtx },
        ),
      ),
  )

  server.registerTool(
    "meter_entitlement_value",
    {
      description:
        "Current entitlement state for a subject on a feature (Meter): hasAccess, usage, balance, overage and per-pool breakdown.",
      inputSchema: {
        teamId: z.string(),
        featureKey: z.string(),
        subject: z.string().describe("The identity key of the subject"),
      },
    },
    async ({ teamId, featureKey, subject }) =>
      text(
        await call(
          meterAdminRouter.entitlementValue,
          { teamId, featureKey, subject },
          {
            context: {
              ...adminCtx,
              storeFor: (forTeam: string) => createD1EventStore(db, forTeam),
            },
          },
        ),
      ),
  )

  server.registerTool(
    "experiments_results",
    {
      description:
        "A/B experiment results: per-variant exposures/conversions/rates, Bayesian chance-to-beat-control, p-values, and SRM health.",
      inputSchema: { teamId: z.string(), experimentKey: z.string() },
    },
    async ({ teamId, experimentKey }) =>
      text(
        await call(
          experimentsAdminRouter.results,
          { teamId, experimentKey },
          { context: adminCtx },
        ),
      ),
  )

  server.registerTool(
    "flags_evaluate",
    {
      description:
        "Evaluate all feature flags for an identity in an environment, with the deciding source per flag (identity-override / segment / default).",
      inputSchema: {
        teamId: z.string(),
        environmentKey: z.string().default("production"),
        identityKey: z.string(),
      },
    },
    async ({ teamId, environmentKey, identityKey }) =>
      text(
        await call(
          flagsAdminRouter.testEvaluate,
          { teamId, environmentKey, identityKey },
          { context: adminCtx },
        ),
      ),
  )

  server.registerTool(
    "flags_set_state",
    {
      description:
        "Enable or disable a feature flag's environment default. The only write tool — overrides and creation stay in the dashboard.",
      inputSchema: {
        teamId: z.string(),
        flagKey: z.string(),
        environmentKey: z.string().default("production"),
        enabled: z.boolean(),
      },
    },
    async ({ teamId, flagKey, environmentKey, enabled }) =>
      text(
        await call(
          flagsAdminRouter.setState,
          { teamId, flagKey, environmentKey, enabled },
          { context: adminCtx },
        ),
      ),
  )

  return server
}
