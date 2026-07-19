import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

// Dashboards — grids of AI-authored panels. Panels are created ONLY
// via MCP (natural language → SQL → preview → save); the UI arranges
// (drag/resize/remove) and views. Layout lives on the dashboard row as
// one JSON array so a drag session saves atomically.

export type PanelLayout = {
  panelId: string
  x: number
  y: number
  w: number
  h: number
}

export type ChartType = "line" | "bar" | "area" | "stat" | "table" | "pie"

export type PanelConfig = {
  // Column driving the x axis (line/bar/area) or slice label (pie).
  xKey?: string
  // Numeric series columns (line/bar/area).
  yKeys?: string[]
  // Value column for stat/pie.
  valueKey?: string
}

export const dashDashboard = sqliteTable(
  "dash_dashboard",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    name: text("name").notNull(),
    layout: text("layout", { mode: "json" }).$type<PanelLayout[]>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("dash_dashboard_team_idx").on(table.teamId)],
)

export const dashPanel = sqliteTable(
  "dash_panel",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    dashboardId: text("dashboard_id").notNull(),
    title: text("title").notNull(),
    chartType: text("chart_type").$type<ChartType>().notNull(),
    // Guarded SQL over the source CTEs (see engine.ts) — stored as
    // authored, sandboxed at execution time.
    sql: text("sql").notNull(),
    config: text("config", { mode: "json" }).$type<PanelConfig>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("dash_panel_dashboard_idx").on(table.dashboardId)],
)

export const dashShare = sqliteTable(
  "dash_share",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    dashboardId: text("dashboard_id").notNull(),
    // Stored (not stateless) because shares are disable-able from the
    // UI — revocation needs a row.
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("dash_share_token_idx").on(table.token),
    index("dash_share_dashboard_idx").on(table.dashboardId),
  ],
)
