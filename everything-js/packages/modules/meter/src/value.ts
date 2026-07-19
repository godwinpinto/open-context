import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import type { ModuleDatabase } from "./context"
import { currentPeriodStart, type UsagePeriod } from "./period"
import { meter, meterEntitlement, meterFeature } from "./schema"
import type { Aggregation, EventStore } from "./store"

export type EntitlementValue = {
  hasAccess: boolean
  type: "metered" | "boolean"
  usage: number | null
  balance: number | null
  overage: number | null
  limit: number | null
  periodStart: string | null
}

export async function resolveFeature(
  db: ModuleDatabase,
  teamId: string,
  featureKey: string,
) {
  const [feature] = await db
    .select()
    .from(meterFeature)
    .where(
      and(eq(meterFeature.teamId, teamId), eq(meterFeature.key, featureKey)),
    )
  if (!feature) {
    throw new ORPCError("NOT_FOUND", { message: "Unknown feature" })
  }
  return feature
}

// The derived-counter core: balance is computed from events every time,
// never stored — idempotent ingestion (eventId dedup) and the event log
// as audit trail come for free.
export async function computeEntitlementValue(options: {
  db: ModuleDatabase
  store: EventStore
  teamId: string
  featureKey: string
  subject: string
  now?: Date
}): Promise<EntitlementValue> {
  const { db, store, teamId, featureKey, subject } = options
  const now = options.now ?? new Date()

  const feature = await resolveFeature(db, teamId, featureKey)
  const [entitlement] = await db
    .select()
    .from(meterEntitlement)
    .where(
      and(
        eq(meterEntitlement.teamId, teamId),
        eq(meterEntitlement.featureId, feature.id),
        eq(meterEntitlement.subject, subject),
      ),
    )
  if (!entitlement) {
    return {
      hasAccess: false,
      type: "boolean",
      usage: null,
      balance: null,
      overage: null,
      limit: null,
      periodStart: null,
    }
  }

  if (entitlement.type === "boolean" || !feature.meterId) {
    return {
      hasAccess: entitlement.enabled,
      type: "boolean",
      usage: null,
      balance: null,
      overage: null,
      limit: null,
      periodStart: null,
    }
  }

  const [meterRow] = await db
    .select()
    .from(meter)
    .where(and(eq(meter.teamId, teamId), eq(meter.id, feature.meterId)))
  if (!meterRow) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Feature references a missing meter",
    })
  }

  const periodStart = currentPeriodStart(
    entitlement.usagePeriod as UsagePeriod,
    now,
  )
  const rows = await store.aggregate({
    eventType: meterRow.eventType,
    aggregation: meterRow.aggregation as Aggregation,
    valueProperty: meterRow.valueProperty,
    from: periodStart,
    // Aggregate windows are [from, to) and timestamps have second
    // granularity — nudge past "now" so an event ingested in the same
    // second (the /usage endpoint's own write) is included.
    to: new Date(now.getTime() + 1000),
    subject,
  })
  const usage = rows[0]?.value ?? 0
  const limit = entitlement.limit ?? 0
  const balance = Math.max(limit - usage, 0)
  const overage = Math.max(usage - limit, 0)

  return {
    hasAccess: entitlement.isSoftLimit ? true : usage < limit,
    type: "metered",
    usage,
    balance,
    overage,
    limit,
    periodStart: periodStart.toISOString(),
  }
}
