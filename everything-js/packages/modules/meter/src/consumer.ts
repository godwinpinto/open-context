import { ORPCError, os } from "@orpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import type { MeterConsumerContext } from "./context"
import { meter } from "./schema"
import { computeEntitlementValue, resolveFeature } from "./value"

const base = os.$context<MeterConsumerContext>()

const eventInput = z.object({
  // Client-supplied id = the idempotency key. Omit for fire-and-forget.
  id: z.string().max(200).optional(),
  type: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  time: z.iso.datetime().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

// POST /api/meter/v1/events — single or batch, CloudEvents-lite.
const ingest = base
  .route({ method: "POST", path: "/events" })
  .input(z.union([eventInput, z.array(eventInput).min(1).max(500)]))
  .handler(async ({ input, context }) => {
    const events = Array.isArray(input) ? input : [input]
    const result = await context.store.insert(
      events.map((event) => ({
        id: event.id ?? crypto.randomUUID(),
        type: event.type,
        subject: event.subject,
        source: "api",
        time: event.time ? new Date(event.time) : new Date(),
        data: event.data ?? null,
      })),
    )
    return { accepted: result.accepted }
  })

// GET /api/meter/v1/entitlements/{subject}/{featureKey}/value — the hot
// path: "can this user still do the thing, and how much is left?"
const value = base
  .route({
    method: "GET",
    path: "/entitlements/{subject}/{featureKey}/value",
  })
  .input(z.object({ subject: z.string(), featureKey: z.string() }))
  .handler(({ input, context }) =>
    computeEntitlementValue({
      db: context.db,
      store: context.store,
      teamId: context.teamId,
      featureKey: input.featureKey,
      subject: input.subject,
    }),
  )

// POST /api/meter/v1/entitlements/{subject}/{featureKey}/usage — the
// counter-style convenience: record a delta (negative = refund) as a
// normal event against the feature's meter, then return fresh access
// state in the same round trip.
const usage = base
  .route({
    method: "POST",
    path: "/entitlements/{subject}/{featureKey}/usage",
  })
  .input(
    z.object({
      subject: z.string(),
      featureKey: z.string(),
      delta: z.number().refine((n) => n !== 0, "delta must be non-zero"),
      // Pass your request id to make retries idempotent.
      eventId: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const feature = await resolveFeature(
      context.db,
      context.teamId,
      input.featureKey,
    )
    if (!feature.meterId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Feature has no meter — usage does not apply",
      })
    }
    const [meterRow] = await context.db
      .select()
      .from(meter)
      .where(
        and(eq(meter.teamId, context.teamId), eq(meter.id, feature.meterId)),
      )
    if (!meterRow) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Feature references a missing meter",
      })
    }
    // Synthesize the event's data so the meter's valueProperty picks up
    // the delta. Only simple "$.prop" paths are supported here.
    const path = meterRow.valueProperty ?? "$.value"
    const match = /^\$\.([A-Za-z0-9_]+)$/.exec(path)
    if (!match) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Meter valueProperty ${path} is not a simple property; ingest events directly instead`,
      })
    }

    await context.store.insert([
      {
        id: input.eventId ?? crypto.randomUUID(),
        type: meterRow.eventType,
        subject: input.subject,
        source: "usage-api",
        time: new Date(),
        data: { [match[1]]: input.delta },
      },
    ])

    return computeEntitlementValue({
      db: context.db,
      store: context.store,
      teamId: context.teamId,
      featureKey: input.featureKey,
      subject: input.subject,
    })
  })

export const meterConsumerRouter = {
  ingest,
  value,
  usage,
}
