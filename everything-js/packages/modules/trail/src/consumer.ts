import { os } from "@orpc/server"
import { z } from "zod"

import type { TrailConsumerContext } from "./context"
import { trailEvent } from "./schema"

const base = os.$context<TrailConsumerContext>()

// POST /api/trail/v1/capture — the SDK-facing ingest endpoint.
// Team scope comes from the API key (resolved by the host), never from
// the request body.
const capture = base
  .route({ method: "POST", path: "/capture" })
  .input(
    z.object({
      name: z.string().min(1).max(200),
      properties: z.record(z.string(), z.unknown()).optional(),
      distinctId: z.string().max(200).optional(),
      timestamp: z.iso.datetime().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const now = new Date()
    const id = crypto.randomUUID()
    await context.db.insert(trailEvent).values({
      id,
      teamId: context.teamId,
      name: input.name,
      properties: input.properties ?? null,
      distinctId: input.distinctId ?? null,
      timestamp: input.timestamp ? new Date(input.timestamp) : now,
      createdAt: now,
    })
    return { id }
  })

export const trailConsumerRouter = {
  capture,
}
