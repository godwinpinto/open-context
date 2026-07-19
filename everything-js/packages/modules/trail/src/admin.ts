import { os } from "@orpc/server"
import { desc, eq, sql } from "drizzle-orm"
import { z } from "zod"

import type { TrailAdminContext } from "./context"
import { trailEvent } from "./schema"

const base = os.$context<TrailAdminContext>()

// Convention: every admin procedure takes teamId in its input and calls
// assertTeamAccess before touching data — the host throws for
// non-members.

const listEvents = base
  .input(
    z.object({
      teamId: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const events = await context.db
      .select()
      .from(trailEvent)
      .where(eq(trailEvent.teamId, input.teamId))
      .orderBy(desc(trailEvent.timestamp))
      .limit(input.limit)
    return { events }
  })

const stats = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [row] = await context.db
      .select({ count: sql<number>`count(*)` })
      .from(trailEvent)
      .where(eq(trailEvent.teamId, input.teamId))
    return { totalEvents: row?.count ?? 0 }
  })

export const trailAdminRouter = {
  listEvents,
  stats,
}
