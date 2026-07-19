import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

import type { SegmentRules } from "./rules"

// Segments — named predicates over identities, consumed as filters by
// every module (flags targeting, metered grants, event filtering).
// Two types:
//   dynamic — rule-based over an identity's MERGED properties (traits
//             only in v1; behavioral conditions are a separate future
//             concern with module-registered resolvers)
//   manual  — explicit membership list (oc_segment_identity)
export const coreSegment = sqliteTable(
  "oc_segment",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(), // dynamic | manual
    rules: text("rules", { mode: "json" }).$type<SegmentRules>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("oc_segment_key_idx").on(table.teamId, table.key)],
)

export const coreSegmentIdentity = sqliteTable(
  "oc_segment_identity",
  {
    teamId: text("team_id").notNull(),
    segmentId: text("segment_id").notNull(),
    identityId: text("identity_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oc_segment_identity_idx").on(
      table.segmentId,
      table.identityId,
    ),
    index("oc_segment_identity_team_idx").on(table.teamId, table.identityId),
  ],
)
