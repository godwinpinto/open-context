import { ORPCError, os } from "@orpc/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import type { DashboardsAdminContext } from "./context"
import { runGuardedQuery, validatePanelSql } from "./engine"
import { dashDashboard, dashPanel, dashShare } from "./schema"
import { SOURCES } from "./sources"

const base = os.$context<DashboardsAdminContext>()

const chartTypeSchema = z.enum(["line", "bar", "area", "stat", "table", "pie"])

const configSchema = z.object({
  xKey: z.string().max(100).optional(),
  yKeys: z.array(z.string().max(100)).max(10).optional(),
  valueKey: z.string().max(100).optional(),
})

const rangeSchema = z.object({
  fromMs: z.number().int().nonnegative(),
  toMs: z.number().int().positive(),
})

const layoutSchema = z.array(
  z.object({
    panelId: z.string(),
    x: z.number().int().min(0).max(11),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(24),
  }),
)

// ——— Dashboards ———

const listDashboards = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const dashboards = await context.db
      .select()
      .from(dashDashboard)
      .where(eq(dashDashboard.teamId, input.teamId))
      .orderBy(desc(dashDashboard.createdAt))
    return { dashboards }
  })

const createDashboard = base
  .input(z.object({ teamId: z.string(), name: z.string().min(1).max(100) }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const now = new Date()
    const dashboard = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      name: input.name,
      layout: [],
      createdAt: now,
      updatedAt: now,
    }
    await context.db.insert(dashDashboard).values(dashboard)
    return { dashboard }
  })

const deleteDashboard = base
  .input(z.object({ teamId: z.string(), id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const scope = and(
      eq(dashPanel.teamId, input.teamId),
      eq(dashPanel.dashboardId, input.id),
    )
    await context.db.delete(dashPanel).where(scope)
    await context.db
      .delete(dashShare)
      .where(
        and(
          eq(dashShare.teamId, input.teamId),
          eq(dashShare.dashboardId, input.id),
        ),
      )
    await context.db
      .delete(dashDashboard)
      .where(
        and(eq(dashDashboard.teamId, input.teamId), eq(dashDashboard.id, input.id)),
      )
    return { ok: true }
  })

const getDashboard = base
  .input(z.object({ teamId: z.string(), id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [dashboard] = await context.db
      .select()
      .from(dashDashboard)
      .where(
        and(eq(dashDashboard.teamId, input.teamId), eq(dashDashboard.id, input.id)),
      )
    if (!dashboard) throw new ORPCError("NOT_FOUND", { message: "No such dashboard" })
    const panels = await context.db
      .select()
      .from(dashPanel)
      .where(
        and(eq(dashPanel.teamId, input.teamId), eq(dashPanel.dashboardId, input.id)),
      )
    const shares = await context.db
      .select()
      .from(dashShare)
      .where(
        and(eq(dashShare.teamId, input.teamId), eq(dashShare.dashboardId, input.id)),
      )
      .orderBy(desc(dashShare.createdAt))
    return { dashboard, panels, shares }
  })

const saveLayout = base
  .input(z.object({ teamId: z.string(), id: z.string(), layout: layoutSchema }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .update(dashDashboard)
      .set({ layout: input.layout, updatedAt: new Date() })
      .where(
        and(eq(dashDashboard.teamId, input.teamId), eq(dashDashboard.id, input.id)),
      )
    return { ok: true }
  })

// ——— Panels (authored via MCP; UI only removes/arranges) ———

const listSources = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    return {
      sources: SOURCES.map((source) => ({
        name: source.name,
        description: source.description,
        timeColumn: source.timeColumn,
        columns: source.columns,
      })),
      notes:
        "Write SQLite SELECT queries against these sources (they are CTEs, already scoped to the team and the dashboard's global time range on timeColumn). JSON columns use json_extract(col, '$.field'). Timestamps are unix seconds — bucket by day with date(col, 'unixepoch'). Max 1000 rows.",
    }
  })

const previewQuery = base
  .input(
    z.object({ teamId: z.string(), sql: z.string(), range: rangeSchema }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    return runGuardedQuery(context.db, input.teamId, input.sql, input.range)
  })

const savePanel = base
  .input(
    z.object({
      teamId: z.string(),
      dashboardId: z.string(),
      title: z.string().min(1).max(120),
      chartType: chartTypeSchema,
      sql: z.string(),
      config: configSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const valid = validatePanelSql(input.sql)
    if (!valid.ok) throw new ORPCError("BAD_REQUEST", { message: valid.error })
    const [dashboard] = await context.db
      .select()
      .from(dashDashboard)
      .where(
        and(
          eq(dashDashboard.teamId, input.teamId),
          eq(dashDashboard.id, input.dashboardId),
        ),
      )
    if (!dashboard) throw new ORPCError("NOT_FOUND", { message: "No such dashboard" })

    const panel = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      dashboardId: input.dashboardId,
      title: input.title,
      chartType: input.chartType,
      sql: input.sql,
      config: input.config,
      createdAt: new Date(),
    }
    await context.db.insert(dashPanel).values(panel)
    // Append to the layout below existing panels, half-width.
    const maxY = dashboard.layout.reduce(
      (max, item) => Math.max(max, item.y + item.h),
      0,
    )
    await context.db
      .update(dashDashboard)
      .set({
        layout: [
          ...dashboard.layout,
          { panelId: panel.id, x: 0, y: maxY, w: 6, h: 4 },
        ],
        updatedAt: new Date(),
      })
      .where(eq(dashDashboard.id, dashboard.id))
    return { panel }
  })

const deletePanel = base
  .input(z.object({ teamId: z.string(), id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [panel] = await context.db
      .select()
      .from(dashPanel)
      .where(and(eq(dashPanel.teamId, input.teamId), eq(dashPanel.id, input.id)))
    if (!panel) return { ok: true }
    await context.db
      .delete(dashPanel)
      .where(eq(dashPanel.id, panel.id))
    const [dashboard] = await context.db
      .select()
      .from(dashDashboard)
      .where(eq(dashDashboard.id, panel.dashboardId))
    if (dashboard) {
      await context.db
        .update(dashDashboard)
        .set({
          layout: dashboard.layout.filter((item) => item.panelId !== panel.id),
          updatedAt: new Date(),
        })
        .where(eq(dashDashboard.id, dashboard.id))
    }
    return { ok: true }
  })

const runPanel = base
  .input(z.object({ teamId: z.string(), panelId: z.string(), range: rangeSchema }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [panel] = await context.db
      .select()
      .from(dashPanel)
      .where(
        and(eq(dashPanel.teamId, input.teamId), eq(dashPanel.id, input.panelId)),
      )
    if (!panel) throw new ORPCError("NOT_FOUND", { message: "No such panel" })
    return runGuardedQuery(context.db, input.teamId, panel.sql, input.range)
  })

// ——— Shares ———

const createShare = base
  .input(
    z.object({
      teamId: z.string(),
      dashboardId: z.string(),
      // Days from now; omit for no expiry.
      expiresInDays: z.number().int().min(1).max(365).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const share = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      dashboardId: input.dashboardId,
      token: `dsh_${crypto.randomUUID().replace(/-/g, "")}`,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86400_000)
        : null,
      disabled: false,
      createdAt: new Date(),
    }
    await context.db.insert(dashShare).values(share)
    return { share, path: `/share/d/${share.token}` }
  })

const setShareDisabled = base
  .input(z.object({ teamId: z.string(), id: z.string(), disabled: z.boolean() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .update(dashShare)
      .set({ disabled: input.disabled })
      .where(and(eq(dashShare.teamId, input.teamId), eq(dashShare.id, input.id)))
    return { ok: true }
  })

const deleteShare = base
  .input(z.object({ teamId: z.string(), id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .delete(dashShare)
      .where(and(eq(dashShare.teamId, input.teamId), eq(dashShare.id, input.id)))
    return { ok: true }
  })

export const dashboardsAdminRouter = {
  listDashboards,
  createDashboard,
  deleteDashboard,
  getDashboard,
  saveLayout,
  listSources,
  previewQuery,
  savePanel,
  deletePanel,
  runPanel,
  createShare,
  setShareDisabled,
  deleteShare,
}
