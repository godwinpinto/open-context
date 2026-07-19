import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

// Core identity layer. An IDENTITY is any principal the platform
// customer's product identifies — a person, a service account, a
// device. A GROUP is a set of identities with shared properties
// (Segment group() / PostHog Groups). Every module references
// identities loosely by (teamId, key): Trail's distinctId and Meter's
// subject are identity keys.
//
// IDs are deterministic UUIDv5 of `${teamId}:${key}` (see ids.ts) —
// computable anywhere without a lookup, which makes creation
// idempotent and cross-store joins (D1 ↔ ClickHouse) possible by
// derivation. Consequence: keys are immutable identifiers; display
// names belong in properties.

export const coreIdentity = sqliteTable(
  "oc_identity",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    properties: text("properties", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oc_identity_key_idx").on(table.teamId, table.key),
    index("oc_identity_last_seen_idx").on(table.teamId, table.lastSeenAt),
  ],
)

export const coreGroup = sqliteTable(
  "oc_group",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    properties: text("properties", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("oc_group_key_idx").on(table.teamId, table.key)],
)

export const coreIdentityGroup = sqliteTable(
  "oc_identity_group",
  {
    teamId: text("team_id").notNull(),
    identityId: text("identity_id").notNull(),
    groupId: text("group_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oc_identity_group_idx").on(
      table.identityId,
      table.groupId,
    ),
    index("oc_identity_group_team_idx").on(table.teamId, table.groupId),
  ],
)
