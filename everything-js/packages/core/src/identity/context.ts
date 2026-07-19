import type { DrizzleD1Database } from "drizzle-orm/d1"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoreDatabase = DrizzleD1Database<any>

export type IdentityConsumerContext = {
  db: CoreDatabase
  teamId: string
  // Platform auth secret — signs stateless portal tokens (host-provided;
  // core takes no env).
  portalSecret: string
}

export type IdentityAdminContext = {
  db: CoreDatabase
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
}
