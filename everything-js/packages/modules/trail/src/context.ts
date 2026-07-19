import type { DrizzleD1Database } from "drizzle-orm/d1"

// The host (apps/admin) owns authentication entirely. Modules receive
// an already-authenticated context; they never see cookies or API keys.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleDatabase = DrizzleD1Database<any>

// Admin surface (/api/{module}/admin/*): caller is a signed-in user of
// our admin panel. Procedures take teamId as input; the host-provided
// assertTeamAccess throws unless the session user is a member of that
// team's organization.
export type TrailAdminContext = {
  db: ModuleDatabase
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
}

// Consumer surface (/api/{module}/v1/*): caller is an external tool or
// SDK holding an API key. The host resolved the key to a team before
// invoking the module — the URL can never vary the scope.
export type TrailConsumerContext = {
  db: ModuleDatabase
  teamId: string
}
