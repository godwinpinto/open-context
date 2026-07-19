import { os } from "@orpc/server"
import { and, desc, eq, like, lt, or } from "drizzle-orm"
import { z } from "zod"

import type { IdentityAdminContext } from "./context"
import { coreGroup, coreIdentity, coreIdentityGroup } from "./schema"
import { getMergedProperties } from "./store"

const base = os.$context<IdentityAdminContext>()

// Keyset cursor: (lastSeenAt desc, id desc); ts is epoch ms. lastSeenAt
// moves as identities are seen again — a row active mid-scroll can
// reappear on an earlier page, which is acceptable for this view.
const listIdentities = base
  .input(
    z.object({
      teamId: z.string(),
      search: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.object({ ts: z.number().int(), id: z.string() }).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const filters = [eq(coreIdentity.teamId, input.teamId)]
    if (input.search) {
      filters.push(like(coreIdentity.key, `%${input.search}%`))
    }
    if (input.cursor) {
      const at = new Date(input.cursor.ts)
      filters.push(
        or(
          lt(coreIdentity.lastSeenAt, at),
          and(
            eq(coreIdentity.lastSeenAt, at),
            lt(coreIdentity.id, input.cursor.id),
          ),
        )!,
      )
    }
    const rows = await context.db
      .select()
      .from(coreIdentity)
      .where(and(...filters))
      .orderBy(desc(coreIdentity.lastSeenAt), desc(coreIdentity.id))
      .limit(input.limit + 1)
    const identities = rows.slice(0, input.limit)
    const last = identities[identities.length - 1]
    const nextCursor =
      rows.length > input.limit && last
        ? { ts: last.lastSeenAt.getTime(), id: last.id }
        : null
    return { identities, nextCursor }
  })

const getIdentity = base
  .input(z.object({ teamId: z.string(), key: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [identity] = await context.db
      .select()
      .from(coreIdentity)
      .where(
        and(
          eq(coreIdentity.teamId, input.teamId),
          eq(coreIdentity.key, input.key),
        ),
      )
    if (!identity) return { identity: null, merged: null }
    const merged = await getMergedProperties(
      context.db,
      input.teamId,
      input.key,
    )
    return { identity, merged }
  })

const deleteIdentity = base
  .input(z.object({ teamId: z.string(), key: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [identity] = await context.db
      .select({ id: coreIdentity.id })
      .from(coreIdentity)
      .where(
        and(
          eq(coreIdentity.teamId, input.teamId),
          eq(coreIdentity.key, input.key),
        ),
      )
    if (identity) {
      await context.db
        .delete(coreIdentityGroup)
        .where(eq(coreIdentityGroup.identityId, identity.id))
      await context.db
        .delete(coreIdentity)
        .where(eq(coreIdentity.id, identity.id))
    }
    return { success: true }
  })

const listGroups = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const groups = await context.db
      .select()
      .from(coreGroup)
      .where(eq(coreGroup.teamId, input.teamId))
      .orderBy(desc(coreGroup.createdAt))
    return { groups }
  })

export const identityAdminRouter = {
  listIdentities,
  getIdentity,
  deleteIdentity,
  listGroups,
}
