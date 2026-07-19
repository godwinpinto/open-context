import { os } from "@orpc/server"
import { and, eq } from "drizzle-orm"
import { identityId, identityInSegments, variantFor } from "@open-context/core"
import { z } from "zod"

import type { ExperimentsConsumerContext } from "./context"
import { expExperiment, expExposure, expGoal } from "./schema"

const base = os.$context<ExperimentsConsumerContext>()

const keySchema = z.string().min(1).max(200)

async function assignOne(
  context: ExperimentsConsumerContext,
  experiment: typeof expExperiment.$inferSelect,
  identityKey: string,
  segmentsCache?: string[],
): Promise<string | null> {
  if (experiment.status !== "running") return null

  if (experiment.segmentKey) {
    const segments =
      segmentsCache ??
      (await identityInSegments(context.db, context.teamId, identityKey))
    if (!segments.includes(experiment.segmentKey)) return null
  }

  // Deterministic (frozen hash) — same identity always gets the same
  // variant. The exposure row records first sight for analysis.
  const variant = variantFor(experiment.id, identityKey, experiment.variants)
  await context.db
    .insert(expExposure)
    .values({
      id: crypto.randomUUID(),
      teamId: context.teamId,
      experimentId: experiment.id,
      identityId: await identityId(context.teamId, identityKey),
      identityKey,
      variant,
      exposedAt: new Date(),
    })
    .onConflictDoNothing()
  return variant
}

// POST /api/experiments/v1/assign — variant for one experiment;
// exposure recorded server-side (exact, no SDK discipline needed).
const assign = base
  .route({ method: "POST", path: "/assign" })
  .input(z.object({ identity: keySchema, experiment: keySchema }))
  .handler(async ({ input, context }) => {
    const [experiment] = await context.db
      .select()
      .from(expExperiment)
      .where(
        and(
          eq(expExperiment.teamId, context.teamId),
          eq(expExperiment.key, input.experiment),
        ),
      )
    if (!experiment) return { variant: null }
    const variant = await assignOne(context, experiment, input.identity)
    return { variant }
  })

// POST /api/experiments/v1/assignments — all running experiments in
// one call (SDK bootstrap).
const assignments = base
  .route({ method: "POST", path: "/assignments" })
  .input(z.object({ identity: keySchema }))
  .handler(async ({ input, context }) => {
    const experiments = await context.db
      .select()
      .from(expExperiment)
      .where(
        and(
          eq(expExperiment.teamId, context.teamId),
          eq(expExperiment.status, "running"),
        ),
      )
    const needsSegments = experiments.some((e) => e.segmentKey)
    const segments = needsSegments
      ? await identityInSegments(context.db, context.teamId, input.identity)
      : []
    const result: Record<string, string | null> = {}
    for (const experiment of experiments) {
      result[experiment.key] = await assignOne(
        context,
        experiment,
        input.identity,
        segments,
      )
    }
    return { assignments: result }
  })

// POST /api/experiments/v1/goal — explicit conversion. Only counted
// for identities that were exposed (a goal without exposure can't be
// attributed to a variant); first goal per identity counts.
const goal = base
  .route({ method: "POST", path: "/goal" })
  .input(z.object({ identity: keySchema, experiment: keySchema }))
  .handler(async ({ input, context }) => {
    const [experiment] = await context.db
      .select()
      .from(expExperiment)
      .where(
        and(
          eq(expExperiment.teamId, context.teamId),
          eq(expExperiment.key, input.experiment),
        ),
      )
    if (!experiment) return { counted: false, reason: "unknown experiment" }

    const id = await identityId(context.teamId, input.identity)
    const [exposure] = await context.db
      .select()
      .from(expExposure)
      .where(
        and(
          eq(expExposure.experimentId, experiment.id),
          eq(expExposure.identityId, id),
        ),
      )
    if (!exposure) return { counted: false, reason: "not exposed" }

    await context.db
      .insert(expGoal)
      .values({
        id: crypto.randomUUID(),
        teamId: context.teamId,
        experimentId: experiment.id,
        identityId: id,
        goalAt: new Date(),
      })
      .onConflictDoNothing()
    return { counted: true }
  })

export const experimentsConsumerRouter = {
  assign,
  assignments,
  goal,
}
