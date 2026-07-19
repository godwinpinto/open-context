import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import { computeBurnDown, type BurnPool } from "./burndown"
import type { ModuleDatabase } from "./context"
import { currentPeriodStart, type UsagePeriod } from "./period"
import { meter, meterEntitlement, meterFeature, meterGrant } from "./schema"
import type { Aggregation, EventStore } from "./store"

export type EntitlementValue = {
  hasAccess: boolean
  type: "metered" | "boolean"
  usage: number | null
  balance: number | null
  overage: number | null
  limit: number | null
  periodStart: string | null
  pools: { id: string; kind: "allowance" | "grant"; remaining: number }[]
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

const NO_ACCESS: EntitlementValue = {
  hasAccess: false,
  type: "boolean",
  usage: null,
  balance: null,
  overage: null,
  limit: null,
  periodStart: null,
  pools: [],
}

// Balance is computed from events + the pool set on every read — never
// stored. Pools: the entitlement's periodic allowance (limit, resets
// each calendar period, burns at priority 1) plus explicit grants.
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
  if (!entitlement) return NO_ACCESS

  if (entitlement.type === "boolean" || !feature.meterId) {
    return { ...NO_ACCESS, hasAccess: entitlement.enabled }
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

  const pools: BurnPool[] = []
  if (entitlement.limit != null) {
    pools.push({
      id: "allowance",
      kind: "allowance",
      amount: entitlement.limit,
      priority: 1,
      start: periodStart,
      end: null,
      createdAt: entitlement.createdAt,
    })
  }
  const grants = await db
    .select()
    .from(meterGrant)
    .where(
      and(
        eq(meterGrant.teamId, teamId),
        eq(meterGrant.entitlementId, entitlement.id),
      ),
    )
  for (const grant of grants) {
    if (grant.effectiveAt > now) continue
    const ends = [grant.expiresAt, grant.voidedAt]
      .filter((date): date is Date => date != null)
      .map((date) => date.getTime())
    pools.push({
      id: grant.id,
      kind: "grant",
      amount: grant.amount,
      priority: grant.priority,
      start: grant.effectiveAt,
      end: ends.length > 0 ? new Date(Math.min(...ends)) : null,
      createdAt: grant.createdAt,
    })
  }

  const result = await computeBurnDown(pools, now, (from, to) => {
    // Windows are [from, to) with second-granularity timestamps —
    // nudge the final slice past "now" so a same-second write (the
    // /usage endpoint's own event) is included.
    const end =
      to.getTime() === now.getTime() ? new Date(now.getTime() + 1000) : to
    return store
      .aggregate({
        eventType: meterRow.eventType,
        aggregation: meterRow.aggregation as Aggregation,
        valueProperty: meterRow.valueProperty,
        from,
        to: end,
        subject,
      })
      .then((rows) => rows[0]?.value ?? 0)
  })

  return {
    hasAccess: entitlement.isSoftLimit ? true : result.balance > 0,
    type: "metered",
    usage: result.usage,
    balance: result.balance,
    overage: result.overage,
    limit: entitlement.limit,
    periodStart: periodStart.toISOString(),
    pools: result.pools,
  }
}
