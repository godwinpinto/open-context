import { and, desc, eq, inArray, lt, or } from "drizzle-orm"
import {
  assertValidEndpointUrl,
  coreWebhookAttempt,
  coreWebhookEndpoint,
  coreWebhookMessage,
  createWebhookEndpoint,
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

  // ——— Webhook endpoint self-service (Svix App Portal-style): the
  // end-customer manages THEIR OWN endpoints, scoped to the identity
  // baked into the token. ———
  if (path.startsWith("/webhooks")) {
    const denied = requireScope(claims, "webhooks:manage")
    if (denied) return denied
    const db = getDb(env)
    const owned = and(
      eq(coreWebhookEndpoint.teamId, claims.teamId),
      eq(coreWebhookEndpoint.ownerType, "identity"),
      eq(coreWebhookEndpoint.ownerKey, claims.identity),
    )

    if (request.method === "GET" && path === "/webhooks/endpoints") {
      // A customer's own endpoints are few; hard-cap instead of paging.
      const endpoints = await db
        .select()
        .from(coreWebhookEndpoint)
        .where(owned)
        .orderBy(desc(coreWebhookEndpoint.createdAt))
        .limit(200)
      return Response.json({ endpoints })
    }

    if (request.method === "POST" && path === "/webhooks/endpoints") {
      const body = (await request.json().catch(() => null)) as {
        url?: string
        description?: string
        eventTypes?: string[]
      } | null
      if (!body?.url) {
        return Response.json({ error: "url is required" }, { status: 400 })
      }
      const invalid = assertValidEndpointUrl(body.url)
      if (invalid) return Response.json({ error: invalid }, { status: 400 })
      const endpoint = await createWebhookEndpoint(db, claims.teamId, {
        ownerType: "identity",
        ownerKey: claims.identity,
        url: body.url,
        ...(body.description ? { description: body.description } : {}),
        eventTypes: body.eventTypes ?? null,
      })
      return Response.json({ endpoint })
    }

    const deleteMatch = path.match(/^\/webhooks\/endpoints\/([\w-]+)$/)
    if (request.method === "DELETE" && deleteMatch) {
      await db
        .delete(coreWebhookEndpoint)
        .where(and(owned, eq(coreWebhookEndpoint.id, deleteMatch[1]!)))
      return Response.json({ deleted: true })
    }

    if (request.method === "GET" && path === "/webhooks/messages") {
      // Keyset pagination via query params: ?limit=50&cursor_ts=<epoch
      // ms>&cursor_id=<id>. nextCursor in the response feeds the next
      // request; null means no more pages.
      const limitParam = Number(url.searchParams.get("limit"))
      const limit =
        Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= 200
          ? limitParam
          : 50
      const cursorTs = Number(url.searchParams.get("cursor_ts"))
      const cursorId = url.searchParams.get("cursor_id")
      const filters = [
        eq(coreWebhookMessage.teamId, claims.teamId),
        eq(coreWebhookMessage.ownerType, "identity"),
        eq(coreWebhookMessage.ownerKey, claims.identity),
      ]
      if (Number.isFinite(cursorTs) && cursorTs > 0 && cursorId) {
        const at = new Date(cursorTs)
        filters.push(
          or(
            lt(coreWebhookMessage.createdAt, at),
            and(
              eq(coreWebhookMessage.createdAt, at),
              lt(coreWebhookMessage.id, cursorId),
            ),
          )!,
        )
      }
      const rows = await db
        .select()
        .from(coreWebhookMessage)
        .where(and(...filters))
        .orderBy(
          desc(coreWebhookMessage.createdAt),
          desc(coreWebhookMessage.id),
        )
        .limit(limit + 1)
      const messages = rows.slice(0, limit)
      const last = messages.at(-1)
      const nextCursor =
        rows.length > limit && last
          ? { ts: last.createdAt.getTime(), id: last.id }
          : null
      const attempts = messages.length
        ? await db
            .select()
            .from(coreWebhookAttempt)
            .where(
              inArray(
                coreWebhookAttempt.messageId,
                messages.map((message) => message.id),
              ),
            )
        : []
      return Response.json({ messages, attempts, nextCursor })
    }
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}
