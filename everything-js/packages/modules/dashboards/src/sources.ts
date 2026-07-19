// The queryable-source registry — the ONLY doorway from panel SQL to
// real tables. Each source becomes a CTE pre-filtered to the team (and
// to the global time range when it has a timeColumn), so panel SQL is
// tenant-safe and time-bound by construction, never by trust in the
// SQL author (a human or an LLM via MCP).
//
// Timestamps are unix SECONDS (drizzle { mode: "timestamp" }).

export type SourceColumn = {
  name: string
  type: "text" | "integer" | "real" | "json"
  description?: string
}

export type Source = {
  // The CTE name panel SQL references.
  name: string
  table: string
  description: string
  // Underlying column name driving the global time-range filter.
  timeColumn: string | null
  columns: SourceColumn[]
  // Optional per-column SQL override (e.g. quoting reserved words).
  select?: Record<string, string>
}

export const SOURCES: Source[] = [
  {
    name: "trail_events",
    table: "trail_event",
    description:
      "Product analytics events (Trail). One row per tracked event.",
    timeColumn: "timestamp",
    columns: [
      { name: "id", type: "text" },
      { name: "name", type: "text", description: "event name" },
      { name: "properties", type: "json", description: "event properties (use json_extract)" },
      { name: "distinct_id", type: "text", description: "identity key of the actor" },
      { name: "timestamp", type: "integer", description: "unix seconds" },
    ],
  },
  {
    name: "meter_events",
    table: "meter_event",
    description: "Usage metering events (Meter). Values live in data (JSON).",
    timeColumn: "time",
    columns: [
      { name: "id", type: "text", description: "idempotency id" },
      { name: "type", type: "text", description: "event type, matches a meter's event_type" },
      { name: "subject", type: "text", description: "who consumed (identity key)" },
      { name: "source", type: "text" },
      { name: "time", type: "integer", description: "unix seconds" },
      { name: "data", type: "json", description: "payload (use json_extract for values)" },
    ],
  },
  {
    name: "meters",
    table: "meter",
    description: "Meter definitions (aggregation over meter_events).",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "slug", type: "text" },
      { name: "name", type: "text" },
      { name: "aggregation", type: "text" },
      { name: "event_type", type: "text" },
      { name: "value_property", type: "text" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "meter_features",
    table: "meter_feature",
    description: "Sellable features, optionally metered.",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "key", type: "text" },
      { name: "name", type: "text" },
      { name: "meter_id", type: "text" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "meter_entitlements",
    table: "meter_entitlement",
    description: "Per-subject access to features with optional limits.",
    timeColumn: null,
    select: { usage_limit: '"limit"' },
    columns: [
      { name: "id", type: "text" },
      { name: "feature_id", type: "text" },
      { name: "subject", type: "text" },
      { name: "type", type: "text", description: "metered | boolean" },
      { name: "usage_limit", type: "real" },
      { name: "usage_period", type: "text" },
      { name: "enabled", type: "integer" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "meter_grants",
    table: "meter_grant",
    description: "Credit grants stacked on entitlements.",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "entitlement_id", type: "text" },
      { name: "amount", type: "real" },
      { name: "priority", type: "integer" },
      { name: "effective_at", type: "integer" },
      { name: "expires_at", type: "integer" },
      { name: "voided_at", type: "integer" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "identities",
    table: "oc_identity",
    description: "Known principals (users/service accounts/devices).",
    timeColumn: "first_seen_at",
    columns: [
      { name: "id", type: "text" },
      { name: "key", type: "text" },
      { name: "properties", type: "json", description: "traits (use json_extract)" },
      { name: "first_seen_at", type: "integer" },
      { name: "last_seen_at", type: "integer" },
    ],
  },
  {
    name: "groups",
    table: "oc_group",
    description: "Groups of identities with shared properties.",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "key", type: "text" },
      { name: "properties", type: "json" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "identity_groups",
    table: "oc_identity_group",
    description: "Identity ↔ group membership.",
    timeColumn: null,
    columns: [
      { name: "identity_id", type: "text" },
      { name: "group_id", type: "text" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "segments",
    table: "oc_segment",
    description: "Segment definitions (dynamic rules or manual lists).",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "key", type: "text" },
      { name: "name", type: "text" },
      { name: "type", type: "text", description: "dynamic | manual" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "segment_identities",
    table: "oc_segment_identity",
    description: "Manual segment membership rows.",
    timeColumn: null,
    columns: [
      { name: "segment_id", type: "text" },
      { name: "identity_id", type: "text" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "experiments",
    table: "exp_experiment",
    description: "A/B experiment definitions.",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "key", type: "text" },
      { name: "name", type: "text" },
      { name: "status", type: "text", description: "draft | running | stopped" },
      { name: "created_at", type: "integer" },
      { name: "started_at", type: "integer" },
      { name: "stopped_at", type: "integer" },
    ],
  },
  {
    name: "exposures",
    table: "exp_exposure",
    description: "Experiment variant assignments (one per identity).",
    timeColumn: "exposed_at",
    columns: [
      { name: "id", type: "text" },
      { name: "experiment_id", type: "text" },
      { name: "identity_key", type: "text" },
      { name: "variant", type: "text" },
      { name: "exposed_at", type: "integer", description: "unix seconds" },
    ],
  },
  {
    name: "goals",
    table: "exp_goal",
    description: "Experiment conversions (first goal per identity).",
    timeColumn: "goal_at",
    columns: [
      { name: "id", type: "text" },
      { name: "experiment_id", type: "text" },
      { name: "identity_id", type: "text" },
      { name: "goal_at", type: "integer", description: "unix seconds" },
    ],
  },
  {
    name: "flags",
    table: "flag",
    description: "Feature flag definitions.",
    timeColumn: null,
    columns: [
      { name: "id", type: "text" },
      { name: "key", type: "text" },
      { name: "name", type: "text" },
      { name: "created_at", type: "integer" },
    ],
  },
  {
    name: "flag_states",
    table: "flag_state",
    description: "Per-environment flag on/off + value.",
    timeColumn: null,
    columns: [
      { name: "flag_id", type: "text" },
      { name: "environment_id", type: "text" },
      { name: "enabled", type: "integer" },
      { name: "updated_at", type: "integer" },
    ],
  },
  {
    name: "webhook_messages",
    table: "oc_webhook_message",
    description: "Published webhook messages.",
    timeColumn: "created_at",
    columns: [
      { name: "id", type: "text" },
      { name: "owner_type", type: "text" },
      { name: "owner_key", type: "text" },
      { name: "event_type", type: "text" },
      { name: "created_at", type: "integer", description: "unix seconds" },
    ],
  },
  {
    name: "webhook_attempts",
    table: "oc_webhook_attempt",
    description: "Webhook delivery attempts.",
    timeColumn: "created_at",
    columns: [
      { name: "id", type: "text" },
      { name: "message_id", type: "text" },
      { name: "endpoint_id", type: "text" },
      { name: "status", type: "text", description: "pending | success | failed | exhausted" },
      { name: "attempt_number", type: "integer" },
      { name: "http_status", type: "integer" },
      { name: "created_at", type: "integer", description: "unix seconds" },
    ],
  },
]

export const SOURCE_BY_NAME = new Map(SOURCES.map((source) => [source.name, source]))
