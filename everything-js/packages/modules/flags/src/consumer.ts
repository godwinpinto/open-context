import { os } from "@orpc/server"
import { z } from "zod"

import type { FlagsConsumerContext } from "./context"
import { evaluateFlags } from "./evaluate"

const base = os.$context<FlagsConsumerContext>()

// POST /api/flags/v1/evaluate — all flags for an identity in the
// key's environment, one call. `traits` merge over the identity's
// stored properties for segment matching (client-known context like
// current URL or device without needing an identify() first).
const evaluate = base
  .route({ method: "POST", path: "/evaluate" })
  .input(
    z.object({
      identity: z.string().min(1).max(200),
      traits: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const flags = await evaluateFlags(
      context.db,
      context.teamId,
      context.environmentKey,
      input.identity,
      input.traits,
    )
    // SDK shape: sources stripped (debugging detail, admin-only).
    const cleaned: Record<string, { enabled: boolean; value: unknown }> = {}
    for (const [key, result] of Object.entries(flags)) {
      cleaned[key] = { enabled: result.enabled, value: result.value }
    }
    return { environment: context.environmentKey, flags: cleaned }
  })

export const flagsConsumerRouter = {
  evaluate,
}
