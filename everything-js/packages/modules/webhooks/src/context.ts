import type { DrizzleD1Database } from "drizzle-orm/d1"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleDatabase = DrizzleD1Database<any>

export type WebhooksConsumerContext = {
  db: ModuleDatabase
  teamId: string
  // Host-provided scheduler (ctx.waitUntil on Workers, plain await as
  // fallback). Delivery of freshly published messages and the
  // opportunistic retry sweep run through this so the API response
  // never waits on receiver endpoints.
  defer: (work: Promise<unknown>) => void
}

export type WebhooksAdminContext = {
  db: ModuleDatabase
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
}
