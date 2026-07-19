import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// Webhooks — one pub/sub-over-HTTP engine, three variants on the same
// tables distinguished by the endpoint OWNER:
//   owner team     → platform notifications (modules → the team)
//   owner identity → webhooks-as-a-service (a team sends events to
//   owner group      THEIR customers' endpoints — Svix's "application"
//                    maps to our identity/group)
// D1 outbox model: message row is the source of truth, one attempt row
// per (message, endpoint) delivery try. No cron: first attempt runs
// inline (waitUntil) and due retries are swept opportunistically on
// consumer traffic + manually from the admin UI.

export const coreWebhookEndpoint = sqliteTable(
  "oc_webhook_endpoint",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    // team | identity | group — who this endpoint belongs to.
    ownerType: text("owner_type").notNull(),
    // identity/group key; empty string for team-owned endpoints (keeps
    // the composite index usable).
    ownerKey: text("owner_key").notNull().default(""),
    url: text("url").notNull(),
    description: text("description"),
    // Standard Webhooks signing secret (whsec_...). Retrievable by the
    // owner — receivers need it to verify.
    secret: text("secret").notNull(),
    // Optional allow-list of event types; null = receive everything.
    eventTypes: text("event_types", { mode: "json" }).$type<string[] | null>(),
    disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
    disabledReason: text("disabled_reason"),
    // Consecutive exhausted messages; success resets it, hitting the
    // auto-disable threshold flips `disabled`.
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("oc_webhook_endpoint_owner_idx").on(
      table.teamId,
      table.ownerType,
      table.ownerKey,
    ),
  ],
)

export const coreWebhookMessage = sqliteTable(
  "oc_webhook_message",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    ownerType: text("owner_type").notNull(),
    ownerKey: text("owner_key").notNull().default(""),
    eventType: text("event_type").notNull(),
    // Serialized JSON payload — signed and delivered byte-for-byte.
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("oc_webhook_message_team_idx").on(table.teamId, table.createdAt),
  ],
)

export const coreWebhookAttempt = sqliteTable(
  "oc_webhook_attempt",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    messageId: text("message_id").notNull(),
    endpointId: text("endpoint_id").notNull(),
    // pending | success | failed (retry scheduled) | exhausted
    status: text("status").notNull().default("pending"),
    attemptNumber: integer("attempt_number").notNull().default(0),
    httpStatus: integer("http_status"),
    // First bytes of the response / error message, for debugging.
    responseSnippet: text("response_snippet"),
    // Unix ms when this delivery becomes due; the opportunistic sweep
    // picks up rows with nextAttemptAt <= now.
    nextAttemptAt: integer("next_attempt_at").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("oc_webhook_attempt_due_idx").on(
      table.teamId,
      table.status,
      table.nextAttemptAt,
    ),
    index("oc_webhook_attempt_message_idx").on(table.messageId),
  ],
)
