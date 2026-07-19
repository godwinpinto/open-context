import { and, eq } from "drizzle-orm"

import type { CoreDatabase } from "./context"
import { groupId, identityId } from "./ids"
import { applyOps, type PropertyOps } from "./ops"
import { coreGroup, coreIdentity, coreIdentityGroup } from "./schema"

// Shared identity operations — used by the consumer/admin routers AND
// importable by any module (the "maps into all other modules"
// mechanism: package import, not cross-module API calls).

export async function upsertIdentity(
  db: CoreDatabase,
  teamId: string,
  key: string,
  ops: PropertyOps,
) {
  const id = await identityId(teamId, key)
  const now = new Date()
  const [existing] = await db
    .select()
    .from(coreIdentity)
    .where(eq(coreIdentity.id, id))

  const properties = applyOps(existing?.properties ?? {}, ops)
  if (existing) {
    await db
      .update(coreIdentity)
      .set({ properties, lastSeenAt: now })
      .where(eq(coreIdentity.id, id))
  } else {
    await db.insert(coreIdentity).values({
      id,
      teamId,
      key,
      properties,
      firstSeenAt: now,
      lastSeenAt: now,
    })
  }
  return { id, properties }
}

export async function upsertGroup(
  db: CoreDatabase,
  teamId: string,
  key: string,
  ops: PropertyOps,
) {
  const id = await groupId(teamId, key)
  const now = new Date()
  const [existing] = await db
    .select()
    .from(coreGroup)
    .where(eq(coreGroup.id, id))

  const properties = applyOps(existing?.properties ?? {}, ops)
  if (existing) {
    await db
      .update(coreGroup)
      .set({ properties })
      .where(eq(coreGroup.id, id))
  } else {
    await db.insert(coreGroup).values({
      id,
      teamId,
      key,
      properties,
      createdAt: now,
    })
  }
  return { id, properties }
}

export async function attachIdentityToGroup(
  db: CoreDatabase,
  teamId: string,
  identityKey: string,
  groupKey: string,
) {
  // Upsert both ends so attach never fails on ordering.
  const identity = await upsertIdentity(db, teamId, identityKey, {})
  const group = await upsertGroup(db, teamId, groupKey, {})
  await db
    .insert(coreIdentityGroup)
    .values({
      teamId,
      identityId: identity.id,
      groupId: group.id,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
  return { identityId: identity.id, groupId: group.id }
}

// Merged view for consumers (flags evaluation etc.): group properties
// merged under identity properties — identity wins on conflict; groups
// merge in attachment order.
export async function getMergedProperties(
  db: CoreDatabase,
  teamId: string,
  key: string,
): Promise<{
  exists: boolean
  properties: Record<string, unknown>
  groups: { key: string; properties: Record<string, unknown> }[]
}> {
  const id = await identityId(teamId, key)
  const [identity] = await db
    .select()
    .from(coreIdentity)
    .where(eq(coreIdentity.id, id))
  if (!identity) return { exists: false, properties: {}, groups: [] }

  const groups = await db
    .select({
      key: coreGroup.key,
      properties: coreGroup.properties,
      attachedAt: coreIdentityGroup.createdAt,
    })
    .from(coreIdentityGroup)
    .innerJoin(coreGroup, eq(coreIdentityGroup.groupId, coreGroup.id))
    .where(
      and(
        eq(coreIdentityGroup.teamId, teamId),
        eq(coreIdentityGroup.identityId, id),
      ),
    )
    .orderBy(coreIdentityGroup.createdAt)

  const merged: Record<string, unknown> = {}
  for (const group of groups) Object.assign(merged, group.properties)
  Object.assign(merged, identity.properties)

  return {
    exists: true,
    properties: merged,
    groups: groups.map((g) => ({ key: g.key, properties: g.properties })),
  }
}
