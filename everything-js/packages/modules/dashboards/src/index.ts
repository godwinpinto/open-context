// OpenCtx Dashboards — AI-authored analytics grids.
// The concept: you BUILD your dashboard in natural language over MCP
// (list sources → draft guarded SQL → preview → save panel with a
// chart type); the UI is for viewing and arranging only (drag/resize/
// reorder via react-grid-layout, remove panel, global time range,
// shareable links with expiry + disable).
// Safety model: panel SQL only sees per-team, time-filtered CTEs
// (engine.ts) — never real tables.
export { dashboardsAdminRouter } from "./admin"
export {
  buildGuardedSql,
  runGuardedQuery,
  validatePanelSql,
  type QueryRange,
  type QueryResult,
} from "./engine"
export { SOURCES } from "./sources"
export { dashDashboard, dashPanel, dashShare } from "./schema"
export type { ChartType, PanelConfig, PanelLayout } from "./schema"
export type { DashboardsAdminContext, ModuleDatabase } from "./context"

export const dashboardsModule = {
  id: "dashboards",
  name: "Dashboards",
  description: "AI-authored chart grids over your team's data.",
} as const
