import {
  verifyPortalToken,
  type PortalClaims,
  type PortalScope,
} from "@open-context/core"
import {
  createClickHouseEventStore,
  createD1EventStore,
  portalUsage,
  type EventStore,
} from "@open-context/module-meter"

import { getClickHouseConfig } from "../connectors-host"
import { getDb } from "../auth/middleware"

// Portal surface — the 4th auth surface. No session, no API key: a
// stateless HMAC portal token (minted by the team's backend via
// POST /api/identity/v1/portal-tokens) carries {teamId, identity,
// scopes, exp}. Handlers below are scoped to what an END-CUSTOMER of
// a team may see about themselves.

function tokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (header?.startsWith("Bearer ")) return header.slice(7)
  return null
}

function requireScope(claims: PortalClaims, scope: PortalScope) {
  if (!claims.scopes.includes(scope)) {
    return Response.json(
      { error: `Token missing required scope: ${scope}` },
      { status: 403 },
    )
  }
  return null
}

async function storeForTeam(
  db: ReturnType<typeof getDb>,
  teamId: string,
): Promise<EventStore> {
  const clickhouse = await getClickHouseConfig(db, teamId)
  if (clickhouse) return createClickHouseEventStore(clickhouse, teamId)
  return createD1EventStore(db, teamId)
}

export async function handlePortal(request: Request, env: Env) {
  const token = tokenFromRequest(request)
  if (!token) {
    return Response.json({ error: "Missing portal token" }, { status: 401 })
  }
  const claims = await verifyPortalToken(env.BETTER_AUTH_SECRET, token)
  if (!claims) {
    return Response.json(
      { error: "Invalid or expired portal token" },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/portal/, "") || "/"

  if (request.method === "GET" && path === "/me") {
    return Response.json({
      identity: claims.identity,
      scopes: claims.scopes,
      exp: claims.exp,
    })
  }

  if (request.method === "GET" && path === "/meter/usage") {
    const denied = requireScope(claims, "meter:read")
    if (denied) return denied
    const db = getDb(env)
    const store = await storeForTeam(db, claims.teamId)
    const usage = await portalUsage(db, store, claims.teamId, claims.identity)
    return Response.json(usage)
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}
