import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

// Feature flags (Flagsmith-inspired). A flag is defined once per team;
// its STATE (enabled + optional value) is per environment. Overrides
// resolve in Flagsmith's precedence order:
//   identity override → segment overrides (by priority) → env default
// Percentage rollouts come from segments (split conditions) — no
// separate rollout mechanism. Multivariate variants are deliberately
// absent: that's the Experiments module (shared variantFor when flags
// grow variants later).

export const flag = sqliteTable(
  "flag",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("flag_key_idx").on(table.teamId, table.key)],
)

export const flagEnvironment = sqliteTable(
  "flag_environment",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("flag_environment_key_idx").on(table.teamId, table.key),
  ],
)

// Per-environment default state. Missing row = disabled, no value.
export const flagState = sqliteTable(
  "flag_state",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    flagId: text("flag_id").notNull(),
    environmentId: text("environment_id").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    // Optional serve value (remote config): any JSON.
    value: text("value", { mode: "json" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("flag_state_idx").on(table.flagId, table.environmentId),
  ],
)

export const flagSegmentOverride = sqliteTable(
  "flag_segment_override",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    flagId: text("flag_id").notNull(),
    environmentId: text("environment_id").notNull(),
    // Loose reference by key, as everywhere.
    segmentKey: text("segment_key").notNull(),
    // 1 wins first.
    priority: integer("priority").notNull().default(1),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    value: text("value", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("flag_segment_override_idx").on(
      table.flagId,
      table.environmentId,
      table.segmentKey,
    ),
    index("flag_segment_override_env_idx").on(table.environmentId),
  ],
)

export const flagIdentityOverride = sqliteTable(
  "flag_identity_override",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    flagId: text("flag_id").notNull(),
    environmentId: text("environment_id").notNull(),
    identityId: text("identity_id").notNull(),
    identityKey: text("identity_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    value: text("value", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("flag_identity_override_idx").on(
      table.flagId,
      table.environmentId,
      table.identityId,
    ),
    index("flag_identity_override_env_idx").on(
      table.environmentId,
      table.identityId,
    ),
  ],
)
