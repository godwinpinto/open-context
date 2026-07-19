import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { dashboardsAdminRouter } from "@open-context/module-dashboards"

const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/dashboards/admin` })

export const dashboardsClient: RouterClient<typeof dashboardsAdminRouter> =
  createORPCClient(link)

// Global time-range presets shared by the dashboard view and the
// public share view.
export const RANGE_PRESETS = [
  { key: "24h", label: "Last 24 hours", ms: 24 * 3600_000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 86400_000 },
  { key: "30d", label: "Last 30 days", ms: 30 * 86400_000 },
  { key: "90d", label: "Last 90 days", ms: 90 * 86400_000 },
] as const

export type RangeKey = (typeof RANGE_PRESETS)[number]["key"]

export function rangeForKey(key: RangeKey): { fromMs: number; toMs: number } {
  const preset = RANGE_PRESETS.find((entry) => entry.key === key) ?? RANGE_PRESETS[1]
  const toMs = Date.now()
  return { fromMs: toMs - preset.ms, toMs }
}
