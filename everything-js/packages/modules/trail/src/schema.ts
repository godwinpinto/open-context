import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// Module schema fragments are standalone by convention — no FK
// references into the host's auth tables, so the module compiles
// without importing admin's schema. teamId is the scoping column on
// every module table.
export const trailEvent = sqliteTable(
  "trail_event",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    name: text("name").notNull(),
    // Arbitrary JSON payload from the SDK caller.
    properties: text("properties", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    // The end-user in the CUSTOMER's product (distinct id), not one of
    // our users.
    distinctId: text("distinct_id"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("trail_event_team_time_idx").on(table.teamId, table.timestamp),
  ],
)
