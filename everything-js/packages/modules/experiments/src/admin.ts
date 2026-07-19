import { ORPCError, os } from "@orpc/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"

import type { ExperimentsAdminContext } from "./context"
import { expExperiment, expExposure, expGoal } from "./schema"
import { chanceToBeatControl, srmPValue, twoProportionPValue } from "./stats"

const base = os.$context<ExperimentsAdminContext>()

const variantSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, - and _")
    .max(64),
  weight: z.number().positive().max(1000),
})

const listExperiments = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const experiments = await context.db
      .select()
      .from(expExperiment)
      .where(eq(expExperiment.teamId, input.teamId))
      .orderBy(desc(expExperiment.createdAt))
    return { experiments }
  })

const createExperiment = base
  .input(
    z.object({
      teamId: z.string(),
      key: z
        .string()
        .regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, - and _")
        .max(64),
      name: z.string().min(1).max(200),
      hypothesis: z.string().max(2000).optional(),
      segmentKey: z.string().max(64).optional(),
      variants: z.array(variantSchema).min(2).max(10),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const keys = new Set(input.variants.map((variant) => variant.key))
    if (keys.size !== input.variants.length) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Variant keys must be unique",
      })
    }
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      key: input.key,
      name: input.name,
      hypothesis: input.hypothesis ?? null,
      status: "draft",
      segmentKey: input.segmentKey ?? null,
      variants: input.variants,
      createdAt: new Date(),
      startedAt: null,
      stoppedAt: null,
    }
    await context.db.insert(expExperiment).values(row)
    return { experiment: row }
  })

const setStatus = base
  .input(
    z.object({
      teamId: z.string(),
      experimentKey: z.string(),
      action: z.enum(["start", "stop"]),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const patch =
      input.action === "start"
        ? { status: "running", startedAt: new Date() }
        : { status: "stopped", stoppedAt: new Date() }
    await context.db
      .update(expExperiment)
      .set(patch)
      .where(
        and(
          eq(expExperiment.teamId, input.teamId),
          eq(expExperiment.key, input.experimentKey),
        ),
      )
    return { success: true }
  })

const deleteExperiment = base
  .input(z.object({ teamId: z.string(), experimentKey: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [experiment] = await context.db
      .select({ id: expExperiment.id })
      .from(expExperiment)
      .where(
        and(
          eq(expExperiment.teamId, input.teamId),
          eq(expExperiment.key, input.experimentKey),
        ),
      )
    if (experiment) {
      await context.db
        .delete(expExposure)
        .where(eq(expExposure.experimentId, experiment.id))
      await context.db
        .delete(expGoal)
        .where(eq(expGoal.experimentId, experiment.id))
      await context.db
        .delete(expExperiment)
        .where(eq(expExperiment.id, experiment.id))
    }
    return { success: true }
  })

const results = base
  .input(z.object({ teamId: z.string(), experimentKey: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [experiment] = await context.db
      .select()
      .from(expExperiment)
      .where(
        and(
          eq(expExperiment.teamId, input.teamId),
          eq(expExperiment.key, input.experimentKey),
        ),
      )
    if (!experiment) {
      throw new ORPCError("NOT_FOUND", { message: "No such experiment" })
    }

    // Exposures and conversions per variant. Conversions join goals to
    // the identity's exposure variant.
    const exposureRows = await context.db
      .select({
        variant: expExposure.variant,
        count: sql<number>`count(*)`,
      })
      .from(expExposure)
      .where(eq(expExposure.experimentId, experiment.id))
      .groupBy(expExposure.variant)
    const conversionRows = await context.db
      .select({
        variant: expExposure.variant,
        count: sql<number>`count(*)`,
      })
      .from(expGoal)
      .innerJoin(
        expExposure,
        and(
          eq(expGoal.experimentId, expExposure.experimentId),
          eq(expGoal.identityId, expExposure.identityId),
        ),
      )
      .where(eq(expGoal.experimentId, experiment.id))
      .groupBy(expExposure.variant)

    const exposureMap = new Map(exposureRows.map((r) => [r.variant, r.count]))
    const conversionMap = new Map(
      conversionRows.map((r) => [r.variant, r.count]),
    )

    const control = experiment.variants[0]
    const controlStats = {
      exposures: exposureMap.get(control.key) ?? 0,
      conversions: conversionMap.get(control.key) ?? 0,
    }

    const variants = experiment.variants.map((variant, index) => {
      const exposures = exposureMap.get(variant.key) ?? 0
      const conversions = conversionMap.get(variant.key) ?? 0
      const rate = exposures > 0 ? conversions / exposures : 0
      const controlRate =
        controlStats.exposures > 0
          ? controlStats.conversions / controlStats.exposures
          : 0
      const isControl = index === 0
      return {
        key: variant.key,
        weight: variant.weight,
        isControl,
        exposures,
        conversions,
        rate,
        relativeUplift:
          isControl || controlRate === 0
            ? null
            : (rate - controlRate) / controlRate,
        chanceToBeatControl:
          isControl || exposures === 0 || controlStats.exposures === 0
            ? null
            : chanceToBeatControl(controlStats, { exposures, conversions }),
        pValue:
          isControl
            ? null
            : twoProportionPValue(controlStats, { exposures, conversions }),
      }
    })

    const srm = srmPValue(
      experiment.variants.map((variant) => exposureMap.get(variant.key) ?? 0),
      experiment.variants.map((variant) => variant.weight),
    )

    return {
      experiment: {
        key: experiment.key,
        name: experiment.name,
        status: experiment.status,
        startedAt: experiment.startedAt,
      },
      variants,
      srm: {
        pValue: srm,
        // The standard alarm threshold — below this, assignment is
        // suspect and results shouldn't be trusted.
        suspicious: srm !== null && srm < 0.001,
      },
    }
  })

export const experimentsAdminRouter = {
  listExperiments,
  createExperiment,
  setStatus,
  deleteExperiment,
  results,
}
