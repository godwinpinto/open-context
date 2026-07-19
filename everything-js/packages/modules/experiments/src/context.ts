import type { DrizzleD1Database } from "drizzle-orm/d1"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleDatabase = DrizzleD1Database<any>

export type ExperimentsConsumerContext = {
  db: ModuleDatabase
  teamId: string
}

export type ExperimentsAdminContext = {
  db: ModuleDatabase
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
}
