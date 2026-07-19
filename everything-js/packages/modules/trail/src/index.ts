// OpenCtx Trail — reference module for the better-auth-style module
// pattern. A module contributes:
//   - schema fragments  (./schema — merged into the host's drizzle schema)
//   - an admin router   (session-authenticated, consumed by the admin UI)
//   - a consumer router (API-key-authenticated, consumed by SDKs/CLI/MCP)
// The host mounts them under /api/trail/admin/* and /api/trail/v1/*.
// MCP tools will later derive from consumer procedures' zod contracts.
export { trailAdminRouter } from "./admin"
export { trailConsumerRouter } from "./consumer"
export type {
  ModuleDatabase,
  TrailAdminContext,
  TrailConsumerContext,
} from "./context"

export const trailModule = {
  id: "trail",
  name: "Trail",
  description: "Know what your users did.",
} as const
