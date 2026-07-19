import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

// Events. Column-for-column mirror of OpenMeter's ClickHouse table
//   om_events (namespace, id, type, subject, source, time, data, ingested_at)
// with teamId as the namespace, so a future ClickHouse EventStore (via
// the planned per-team connectors) is a drop-in swap. `data` stays raw
// JSON and meters extract values at QUERY time (json_extract here,
// JSONExtract there) — meters created after events exist still
// aggregate history.
export const meterEvent = sqliteTable(
  "meter_event",
  {
    storeRowId: text("store_row_id").primaryKey(),
    teamId: text("team_id").notNull(),
    // Client-supplied event id — the dedup key (with source), so SDK
    // retries can never double-count.
    id: text("id").notNull(),
    type: text("type").notNull(),
    subject: text("subject").notNull(),
    source: text("source").notNull().default("api"),
    time: integer("time", { mode: "timestamp" }).notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    ingestedAt: integer("ingested_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("meter_event_dedup_idx").on(
      table.teamId,
      table.source,
      table.id,
    ),
    index("meter_event_type_time_idx").on(
      table.teamId,
      table.type,
      table.time,
    ),
    index("meter_event_subject_time_idx").on(
      table.teamId,
      table.subject,
      table.time,
    ),
  ],
)

export const meter = sqliteTable(
  "meter",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    // sum | count | unique_count | avg | min | max — slug and
    // aggregation are immutable after creation (OpenMeter rule).
    aggregation: text("aggregation").notNull(),
    eventType: text("event_type").notNull(),
    // Simple JSON path into event data, e.g. "$.tokens". Null for count.
    valueProperty: text("value_property"),
    // name -> JSON path, e.g. { "model": "$.model" }
    groupBy: text("group_by", { mode: "json" }).$type<
      Record<string, string>
    >(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("meter_slug_idx").on(table.teamId, table.slug)],
)

export const meterFeature = sqliteTable(
  "meter_feature",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    // Null → feature has no usage dimension (boolean entitlements only).
    meterId: text("meter_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("meter_feature_key_idx").on(table.teamId, table.key)],
)

export const meterEntitlement = sqliteTable(
  "meter_entitlement",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    featureId: text("feature_id").notNull(),
    // The end-user in the CUSTOMER's product, not one of our users.
    subject: text("subject").notNull(),
    // metered | boolean
    type: text("type").notNull(),
    // metered only: allowance per usage period.
    limit: real("limit"),
    // Soft limit: hasAccess stays true past the limit (report overage).
    isSoftLimit: integer("is_soft_limit", { mode: "boolean" })
      .notNull()
      .default(false),
    // day | week | month — calendar-aligned (UTC) usage periods.
    usagePeriod: text("usage_period").notNull().default("month"),
    // boolean type: the on/off switch.
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("meter_entitlement_subject_idx").on(
      table.teamId,
      table.featureId,
      table.subject,
    ),
  ],
)
