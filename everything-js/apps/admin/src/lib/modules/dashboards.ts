import { RPCHandler } from "@orpc/server/fetch"
import { and, eq } from "drizzle-orm"
import {
  dashboardsAdminRouter,
  dashDashboard,
  dashPanel,
  dashShare,
  runGuardedQuery,
  type DashboardsAdminContext,
} from "@open-context/module-dashboards"

import { getDb } from "../auth/middleware"
import { adminCallContext } from "./host"

const adminHandler = new RPCHandler(dashboardsAdminRouter)

export async function handleDashboardsAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: DashboardsAdminContext = ctx
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/dashboards/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

// ——— Public share surface: /api/share/d/{token}/... ———
// No session, no API key: the stored share row IS the credential.
// Expiry and disable are enforced on every request, so killing a link
// from the UI takes effect immediately.

async function resolveShare(db: ReturnType<typeof getDb>, token: string) {
  const [share] = await db
    .select()
    .from(dashShare)
    .where(eq(dashShare.token, token))
  if (!share || share.disabled) return null
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null
  return share
}

export async function handleDashboardShare(request: Request, env: Env) {
  const url = new URL(request.url)
  // /api/share/d/{token} → dashboard + panels (no SQL leaked)
  // /api/share/d/{token}/panels/{panelId}?fromMs=&toMs= → live data
  const match = url.pathname.match(
    /^\/api\/share\/d\/([\w-]+)(?:\/panels\/([\w-]+))?$/,
  )
  if (!match || request.method !== "GET") {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  const db = getDb(env)
  const share = await resolveShare(db, match[1]!)
  if (!share) {
    return Response.json(
      { error: "This link is invalid, disabled, or expired" },
      { status: 404 },
    )
  }

  if (!match[2]) {
    const [dashboard] = await db
      .select()
      .from(dashDashboard)
      .where(
        and(
          eq(dashDashboard.teamId, share.teamId),
          eq(dashDashboard.id, share.dashboardId),
        ),
      )
    if (!dashboard) return Response.json({ error: "Gone" }, { status: 404 })
    const panels = await db
      .select({
        id: dashPanel.id,
        title: dashPanel.title,
        chartType: dashPanel.chartType,
        config: dashPanel.config,
      })
      .from(dashPanel)
      .where(eq(dashPanel.dashboardId, dashboard.id))
    return Response.json({
      name: dashboard.name,
      layout: dashboard.layout,
      panels,
    })
  }

  const fromMs = Number(url.searchParams.get("fromMs"))
  const toMs = Number(url.searchParams.get("toMs"))
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return Response.json({ error: "Invalid time range" }, { status: 400 })
  }
  const [panel] = await db
    .select()
    .from(dashPanel)
    .where(
      and(
        eq(dashPanel.teamId, share.teamId),
        eq(dashPanel.dashboardId, share.dashboardId),
        eq(dashPanel.id, match[2]),
      ),
    )
  if (!panel) return Response.json({ error: "No such panel" }, { status: 404 })
  const result = await runGuardedQuery(db, share.teamId, panel.sql, {
    fromMs,
    toMs,
  })
  return Response.json(result)
}
