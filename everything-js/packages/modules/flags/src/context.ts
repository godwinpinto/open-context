import type { DrizzleD1Database } from "drizzle-orm/d1"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleDatabase = DrizzleD1Database<any>

export type FlagsConsumerContext = {
  db: ModuleDatabase
  teamId: string
  // From the API key's metadata.environment — a key IS an environment
  // key (Flagsmith model). Defaults to "production" in the host.
  environmentKey: string
}

export type FlagsAdminContext = {
  db: ModuleDatabase
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
}
