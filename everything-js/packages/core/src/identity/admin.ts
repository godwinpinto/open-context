import { os } from "@orpc/server"
import { and, desc, eq, like } from "drizzle-orm"
import { z } from "zod"

import type { IdentityAdminContext } from "./context"
import { coreGroup, coreIdentity, coreIdentityGroup } from "./schema"
import { getMergedProperties } from "./store"

const base = os.$context<IdentityAdminContext>()

const listIdentities = base
  .input(
    z.object({
      teamId: z.string(),
      search: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const filters = [eq(coreIdentity.teamId, input.teamId)]
    if (input.search) {
      filters.push(like(coreIdentity.key, `%${input.search}%`))
    }
    const identities = await context.db
      .select()
      .from(coreIdentity)
      .where(and(...filters))
      .orderBy(desc(coreIdentity.lastSeenAt))
      .limit(input.limit)
    return { identities }
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
