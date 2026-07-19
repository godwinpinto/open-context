import type { DrizzleD1Database } from "drizzle-orm/d1"

import type { EventStore } from "./store"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleDatabase = DrizzleD1Database<any>

// The host owns authentication AND the event-store choice (D1, or a
// per-team ClickHouse connector). Modules never see cookies, API keys,
// or connector configs.

export type MeterAdminContext = {
  db: ModuleDatabase
  userId: string
  assertTeamAccess: (teamId: string) => Promise<void>
  // Store for the team being operated on — async because the host may
  // read (and decrypt) the team's connector config to pick the backend.
  storeFor: (teamId: string) => Promise<EventStore> | EventStore
}

export type MeterConsumerContext = {
  db: ModuleDatabase
  teamId: string
  store: EventStore
}
