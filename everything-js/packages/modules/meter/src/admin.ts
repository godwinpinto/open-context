import { ORPCError, os } from "@orpc/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import type { MeterAdminContext } from "./context"
import { meter, meterEntitlement, meterFeature, meterGrant } from "./schema"
import type { Aggregation, WindowSize } from "./store"
import { computeEntitlementValue } from "./value"

const base = os.$context<MeterAdminContext>()

const aggregationSchema = z.enum([
  "sum",
  "count",
  "unique_count",
  "avg",
  "min",
  "max",
])
const windowSchema = z.enum(["hour", "day", "month"])
const periodSchema = z.enum(["day", "week", "month"])

// ——— Meters ———

const listMeters = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const meters = await context.db
      .select()
      .from(meter)
      .where(eq(meter.teamId, input.teamId))
      .orderBy(desc(meter.createdAt))
    return { meters }
  })

const createMeter = base
  .input(
    z.object({
      teamId: z.string(),
      slug: z
        .string()
        .regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscores")
        .max(64),
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      aggregation: aggregationSchema,
      eventType: z.string().min(1).max(200),
      valueProperty: z
        .string()
        .regex(/^\$\.[A-Za-z0-9_.]+$/, "JSON path like $.tokens")
        .optional(),
      groupBy: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    if (input.aggregation !== "count" && !input.valueProperty) {
      throw new ORPCError("BAD_REQUEST", {
        message: "valueProperty is required unless aggregation is count",
      })
    }
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      aggregation: input.aggregation,
      eventType: input.eventType,
      valueProperty: input.valueProperty ?? null,
      groupBy: input.groupBy ?? null,
      createdAt: new Date(),
    }
    await context.db.insert(meter).values(row)
    return { meter: row }
  })

const deleteMeter = base
  .input(z.object({ teamId: z.string(), meterId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .delete(meter)
      .where(and(eq(meter.teamId, input.teamId), eq(meter.id, input.meterId)))
    return { success: true }
  })

const queryMeter = base
  .input(
    z.object({
      teamId: z.string(),
      meterId: z.string(),
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      windowSize: windowSchema.optional(),
      subject: z.string().optional(),
      groupBy: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [meterRow] = await context.db
      .select()
      .from(meter)
      .where(and(eq(meter.teamId, input.teamId), eq(meter.id, input.meterId)))
    if (!meterRow) throw new ORPCError("NOT_FOUND", { message: "No such meter" })

    let groupBy: { name: string; path: string } | undefined
    if (input.groupBy) {
      const path = meterRow.groupBy?.[input.groupBy]
      if (!path) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Meter has no groupBy dimension "${input.groupBy}"`,
        })
      }
      groupBy = { name: input.groupBy, path }
    }

    const rows = await context.storeFor(input.teamId).aggregate({
      eventType: meterRow.eventType,
      aggregation: meterRow.aggregation as Aggregation,
      valueProperty: meterRow.valueProperty,
      from: new Date(input.from),
      to: new Date(input.to),
      subject: input.subject,
      windowSize: input.windowSize as WindowSize | undefined,
      groupBy,
    })
    return {
      rows: rows.map((row) => ({
        ...row,
        windowStart: row.windowStart.toISOString(),
        windowEnd: row.windowEnd.toISOString(),
      })),
    }
  })

// ——— Events (debug) ———

const listEvents = base
  .input(
    z.object({
      teamId: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
      type: z.string().optional(),
      subject: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const events = await context.storeFor(input.teamId).list({
      limit: input.limit,
      type: input.type,
      subject: input.subject,
    })
    return { events }
  })

// ——— Features ———

const listFeatures = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const features = await context.db
      .select({
        id: meterFeature.id,
        key: meterFeature.key,
        name: meterFeature.name,
        meterId: meterFeature.meterId,
        meterSlug: meter.slug,
        createdAt: meterFeature.createdAt,
      })
      .from(meterFeature)
      .leftJoin(meter, eq(meterFeature.meterId, meter.id))
      .where(eq(meterFeature.teamId, input.teamId))
      .orderBy(desc(meterFeature.createdAt))
    return { features }
  })

const createFeature = base
  .input(
    z.object({
      teamId: z.string(),
      key: z
        .string()
        .regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscores")
        .max(64),
      name: z.string().min(1).max(200),
      meterId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      key: input.key,
      name: input.name,
      meterId: input.meterId ?? null,
      createdAt: new Date(),
    }
    await context.db.insert(meterFeature).values(row)
    return { feature: row }
  })

const deleteFeature = base
  .input(z.object({ teamId: z.string(), featureId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .delete(meterFeature)
      .where(
        and(
          eq(meterFeature.teamId, input.teamId),
          eq(meterFeature.id, input.featureId),
        ),
      )
    return { success: true }
  })

// ——— Entitlements ———

const listEntitlements = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const entitlements = await context.db
      .select({
        id: meterEntitlement.id,
        subject: meterEntitlement.subject,
        type: meterEntitlement.type,
        limit: meterEntitlement.limit,
        isSoftLimit: meterEntitlement.isSoftLimit,
        usagePeriod: meterEntitlement.usagePeriod,
        enabled: meterEntitlement.enabled,
        featureId: meterEntitlement.featureId,
        featureKey: meterFeature.key,
        createdAt: meterEntitlement.createdAt,
      })
      .from(meterEntitlement)
      .innerJoin(meterFeature, eq(meterEntitlement.featureId, meterFeature.id))
      .where(eq(meterEntitlement.teamId, input.teamId))
      .orderBy(desc(meterEntitlement.createdAt))
    return { entitlements }
  })

const createEntitlement = base
  .input(
    z.object({
      teamId: z.string(),
      featureId: z.string(),
      subject: z.string().min(1).max(200),
      type: z.enum(["metered", "boolean"]),
      limit: z.number().positive().optional(),
      isSoftLimit: z.boolean().default(false),
      usagePeriod: periodSchema.default("month"),
      enabled: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    if (input.type === "metered" && input.limit == null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Metered entitlements need a limit",
      })
    }
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      featureId: input.featureId,
      subject: input.subject,
      type: input.type,
      limit: input.limit ?? null,
      isSoftLimit: input.isSoftLimit,
      usagePeriod: input.usagePeriod,
      enabled: input.enabled,
      createdAt: new Date(),
    }
    await context.db.insert(meterEntitlement).values(row)
    return { entitlement: row }
  })

const deleteEntitlement = base
  .input(z.object({ teamId: z.string(), entitlementId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .delete(meterEntitlement)
      .where(
        and(
          eq(meterEntitlement.teamId, input.teamId),
          eq(meterEntitlement.id, input.entitlementId),
        ),
      )
    return { success: true }
  })

// ——— Grants ———

const EXPIRY_UNITS = { hour: 3600, day: 86400, week: 604800 } as const

const listGrants = base
  .input(z.object({ teamId: z.string(), entitlementId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const grants = await context.db
      .select()
      .from(meterGrant)
      .where(
        and(
          eq(meterGrant.teamId, input.teamId),
          eq(meterGrant.entitlementId, input.entitlementId),
        ),
      )
      .orderBy(desc(meterGrant.createdAt))
    return { grants }
  })

const createGrant = base
  .input(
    z.object({
      teamId: z.string(),
      entitlementId: z.string(),
      amount: z.number().positive(),
      // 1 burns first; the periodic allowance burns at 1.
      priority: z.number().int().min(1).max(100).default(1),
      effectiveAt: z.iso.datetime().optional(),
      expiresIn: z
        .object({
          unit: z.enum(["hour", "day", "week"]),
          count: z.number().int().positive().max(520),
        })
        .optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [entitlement] = await context.db
      .select()
      .from(meterEntitlement)
      .where(
        and(
          eq(meterEntitlement.teamId, input.teamId),
          eq(meterEntitlement.id, input.entitlementId),
        ),
      )
    if (!entitlement) {
      throw new ORPCError("NOT_FOUND", { message: "No such entitlement" })
    }
    if (entitlement.type !== "metered") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Grants only apply to metered entitlements",
      })
    }
    const effectiveAt = input.effectiveAt
      ? new Date(input.effectiveAt)
      : new Date()
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      entitlementId: input.entitlementId,
      amount: input.amount,
      priority: input.priority,
      effectiveAt,
      expiresAt: input.expiresIn
        ? new Date(
            effectiveAt.getTime() +
              EXPIRY_UNITS[input.expiresIn.unit] * input.expiresIn.count * 1000,
          )
        : null,
      voidedAt: null,
      createdAt: new Date(),
    }
    await context.db.insert(meterGrant).values(row)
    return { grant: row }
  })

const voidGrant = base
  .input(z.object({ teamId: z.string(), grantId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .update(meterGrant)
      .set({ voidedAt: new Date() })
      .where(
        and(
          eq(meterGrant.teamId, input.teamId),
          eq(meterGrant.id, input.grantId),
        ),
      )
    return { success: true }
  })

// Admin-side view of what a subject currently gets — same computation
// the consumer /value endpoint runs.
const entitlementValue = base
  .input(
    z.object({
      teamId: z.string(),
      featureKey: z.string(),
      subject: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    return computeEntitlementValue({
      db: context.db,
      store: context.storeFor(input.teamId),
      teamId: input.teamId,
      featureKey: input.featureKey,
      subject: input.subject,
    })
  })

export const meterAdminRouter = {
  listMeters,
  createMeter,
  deleteMeter,
  queryMeter,
  listEvents,
  listFeatures,
  createFeature,
  deleteFeature,
  listEntitlements,
  createEntitlement,
  deleteEntitlement,
  entitlementValue,
  listGrants,
  createGrant,
  voidGrant,
}
