import { os } from "@orpc/server"
import { and, desc, eq, lt, or, sql } from "drizzle-orm"
import { z } from "zod"

import type { TrailAdminContext } from "./context"
import { trailEvent } from "./schema"

const base = os.$context<TrailAdminContext>()

// Convention: every admin procedure takes teamId in its input and calls
// assertTeamAccess before touching data — the host throws for
// non-members.

// Keyset cursor: (timestamp desc, id desc). ts is epoch ms of the last
// row's timestamp; id breaks ties within the same second.
const cursorSchema = z.object({ ts: z.number().int(), id: z.string() })

const listEvents = base
  .input(
    z.object({
      teamId: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: cursorSchema.optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const filters = [eq(trailEvent.teamId, input.teamId)]
    if (input.cursor) {
      const at = new Date(input.cursor.ts)
      filters.push(
        or(
          lt(trailEvent.timestamp, at),
          and(
            eq(trailEvent.timestamp, at),
            lt(trailEvent.id, input.cursor.id),
          ),
        )!,
      )
    }
    const rows = await context.db
      .select()
      .from(trailEvent)
      .where(and(...filters))
      .orderBy(desc(trailEvent.timestamp), desc(trailEvent.id))
      .limit(input.limit + 1)
    const events = rows.slice(0, input.limit)
    const last = events[events.length - 1]
    const nextCursor =
      rows.length > input.limit && last
        ? { ts: last.timestamp.getTime(), id: last.id }
        : null
    return { events, nextCursor }
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
