import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export type ExperimentVariant = { key: string; weight: number }

// A/B experiments. Variant assignment is deterministic (core's
// variantFor — frozen hash), so assignments need no storage; the
// exposure table records WHO actually saw the experiment WHEN, which
// is what results are computed over. Goals are explicit conversions
// reported via POST /goal — self-contained, no dependency on Trail.
export const expExperiment = sqliteTable(
  "exp_experiment",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    hypothesis: text("hypothesis"),
    // draft | running | stopped
    status: text("status").notNull().default("draft"),
    // Optional targeting: identities outside the segment are excluded
    // (assign returns null variant).
    segmentKey: text("segment_key"),
    // Control first by convention; weights are relative (needn't sum
    // to 100). Immutable once running — editing weights mid-flight
    // corrupts results.
    variants: text("variants", { mode: "json" })
      .$type<ExperimentVariant[]>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }),
    stoppedAt: integer("stopped_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("exp_experiment_key_idx").on(table.teamId, table.key),
  ],
)

export const expExposure = sqliteTable(
  "exp_exposure",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    experimentId: text("experiment_id").notNull(),
    identityId: text("identity_id").notNull(),
    identityKey: text("identity_key").notNull(),
    variant: text("variant").notNull(),
    exposedAt: integer("exposed_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("exp_exposure_identity_idx").on(
      table.experimentId,
      table.identityId,
    ),
    index("exp_exposure_variant_idx").on(table.experimentId, table.variant),
  ],
)

export const expGoal = sqliteTable(
  "exp_goal",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    experimentId: text("experiment_id").notNull(),
    identityId: text("identity_id").notNull(),
    goalAt: integer("goal_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // Conversion metric: first goal per identity counts, retries are
    // no-ops.
    uniqueIndex("exp_goal_identity_idx").on(
      table.experimentId,
      table.identityId,
    ),
  ],
)
