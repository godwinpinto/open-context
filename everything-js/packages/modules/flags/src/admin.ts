import { ORPCError, os } from "@orpc/server"
import { and, desc, eq, lt, or } from "drizzle-orm"
import { identityId } from "@open-context/core"
import { z } from "zod"

import type { FlagsAdminContext } from "./context"
import { evaluateFlags } from "./evaluate"
import {
  flag,
  flagEnvironment,
  flagIdentityOverride,
  flagSegmentOverride,
  flagState,
} from "./schema"

const base = os.$context<FlagsAdminContext>()

const keyPattern = z
  .string()
  .regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, - and _")
  .max(64)

// ——— Environments ———

const listEnvironments = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const environments = await context.db
      .select()
      .from(flagEnvironment)
      .where(eq(flagEnvironment.teamId, input.teamId))
      .orderBy(desc(flagEnvironment.createdAt))
    return { environments }
  })

const createEnvironment = base
  .input(z.object({ teamId: z.string(), key: keyPattern, name: z.string().min(1).max(100) }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      key: input.key,
      name: input.name,
      createdAt: new Date(),
    }
    await context.db.insert(flagEnvironment).values(row)
    return { environment: row }
  })

// ——— Flags ———

const listFlags = base
  .input(z.object({ teamId: z.string(), environmentKey: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const flags = await context.db
      .select()
      .from(flag)
      .where(eq(flag.teamId, input.teamId))
      .orderBy(desc(flag.createdAt))
    const [environment] = await context.db
      .select()
      .from(flagEnvironment)
      .where(
        and(
          eq(flagEnvironment.teamId, input.teamId),
          eq(flagEnvironment.key, input.environmentKey),
        ),
      )
    const states = environment
      ? await context.db
          .select()
          .from(flagState)
          .where(eq(flagState.environmentId, environment.id))
      : []
    const stateByFlag = new Map(states.map((s) => [s.flagId, s]))
    return {
      flags: flags.map((definition) => ({
        ...definition,
        enabled: stateByFlag.get(definition.id)?.enabled ?? false,
        value: stateByFlag.get(definition.id)?.value ?? null,
      })),
    }
  })

const createFlag = base
  .input(
    z.object({
      teamId: z.string(),
      key: keyPattern,
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const row = {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      createdAt: new Date(),
    }
    await context.db.insert(flag).values(row)
    return { flag: row }
  })

const deleteFlag = base
  .input(z.object({ teamId: z.string(), flagKey: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const [definition] = await context.db
      .select({ id: flag.id })
      .from(flag)
      .where(and(eq(flag.teamId, input.teamId), eq(flag.key, input.flagKey)))
    if (definition) {
      await context.db
        .delete(flagState)
        .where(eq(flagState.flagId, definition.id))
      await context.db
        .delete(flagSegmentOverride)
        .where(eq(flagSegmentOverride.flagId, definition.id))
      await context.db
        .delete(flagIdentityOverride)
        .where(eq(flagIdentityOverride.flagId, definition.id))
      await context.db.delete(flag).where(eq(flag.id, definition.id))
    }
    return { success: true }
  })

async function resolveFlagAndEnvironment(
  context: { db: FlagsAdminContext["db"] },
  teamId: string,
  flagKey: string,
  environmentKey: string,
) {
  const [definition] = await context.db
    .select()
    .from(flag)
    .where(and(eq(flag.teamId, teamId), eq(flag.key, flagKey)))
  const [environment] = await context.db
    .select()
    .from(flagEnvironment)
    .where(
      and(
        eq(flagEnvironment.teamId, teamId),
        eq(flagEnvironment.key, environmentKey),
      ),
    )
  if (!definition || !environment) {
    throw new ORPCError("NOT_FOUND", { message: "Unknown flag or environment" })
  }
  return { definition, environment }
}

// Env default state (upsert).
const setState = base
  .input(
    z.object({
      teamId: z.string(),
      flagKey: z.string(),
      environmentKey: z.string(),
      enabled: z.boolean(),
      value: z.unknown().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const { definition, environment } = await resolveFlagAndEnvironment(
      context,
      input.teamId,
      input.flagKey,
      input.environmentKey,
    )
    await context.db
      .insert(flagState)
      .values({
        id: crypto.randomUUID(),
        teamId: input.teamId,
        flagId: definition.id,
        environmentId: environment.id,
        enabled: input.enabled,
        value: input.value ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [flagState.flagId, flagState.environmentId],
        set: {
          enabled: input.enabled,
          value: input.value ?? null,
          updatedAt: new Date(),
        },
      })
    return { success: true }
  })

// ——— Overrides ———

const setSegmentOverride = base
  .input(
    z.object({
      teamId: z.string(),
      flagKey: z.string(),
      environmentKey: z.string(),
      segmentKey: z.string(),
      priority: z.number().int().min(1).max(100).default(1),
      enabled: z.boolean(),
      value: z.unknown().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const { definition, environment } = await resolveFlagAndEnvironment(
      context,
      input.teamId,
      input.flagKey,
      input.environmentKey,
    )
    await context.db
      .insert(flagSegmentOverride)
      .values({
        id: crypto.randomUUID(),
        teamId: input.teamId,
        flagId: definition.id,
        environmentId: environment.id,
        segmentKey: input.segmentKey,
        priority: input.priority,
        enabled: input.enabled,
        value: input.value ?? null,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          flagSegmentOverride.flagId,
          flagSegmentOverride.environmentId,
          flagSegmentOverride.segmentKey,
        ],
        set: {
          priority: input.priority,
          enabled: input.enabled,
          value: input.value ?? null,
        },
      })
    return { success: true }
  })

const removeSegmentOverride = base
  .input(
    z.object({
      teamId: z.string(),
      flagKey: z.string(),
      environmentKey: z.string(),
      segmentKey: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const { definition, environment } = await resolveFlagAndEnvironment(
      context,
      input.teamId,
      input.flagKey,
      input.environmentKey,
    )
    await context.db
      .delete(flagSegmentOverride)
      .where(
        and(
          eq(flagSegmentOverride.flagId, definition.id),
          eq(flagSegmentOverride.environmentId, environment.id),
          eq(flagSegmentOverride.segmentKey, input.segmentKey),
        ),
      )
    return { success: true }
  })

const setIdentityOverride = base
  .input(
    z.object({
      teamId: z.string(),
      flagKey: z.string(),
      environmentKey: z.string(),
      identityKey: z.string().min(1).max(200),
      enabled: z.boolean(),
      value: z.unknown().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const { definition, environment } = await resolveFlagAndEnvironment(
      context,
      input.teamId,
      input.flagKey,
      input.environmentKey,
    )
    await context.db
      .insert(flagIdentityOverride)
      .values({
        id: crypto.randomUUID(),
        teamId: input.teamId,
        flagId: definition.id,
        environmentId: environment.id,
        identityId: await identityId(input.teamId, input.identityKey),
        identityKey: input.identityKey,
        enabled: input.enabled,
        value: input.value ?? null,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          flagIdentityOverride.flagId,
          flagIdentityOverride.environmentId,
          flagIdentityOverride.identityId,
        ],
        set: { enabled: input.enabled, value: input.value ?? null },
      })
    return { success: true }
  })

const removeIdentityOverride = base
  .input(
    z.object({
      teamId: z.string(),
      flagKey: z.string(),
      environmentKey: z.string(),
      identityKey: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const { definition, environment } = await resolveFlagAndEnvironment(
      context,
      input.teamId,
      input.flagKey,
      input.environmentKey,
    )
    await context.db
      .delete(flagIdentityOverride)
      .where(
        and(
          eq(flagIdentityOverride.flagId, definition.id),
          eq(flagIdentityOverride.environmentId, environment.id),
          eq(
            flagIdentityOverride.identityId,
            await identityId(input.teamId, input.identityKey),
          ),
        ),
      )
    return { success: true }
  })

// Segment overrides are config-scale and returned whole; identity
// overrides can grow per-customer, so they page with a keyset cursor
// (createdAt desc, id desc; ts is epoch ms).
const listOverrides = base
  .input(
    z.object({
      teamId: z.string(),
      flagKey: z.string(),
      environmentKey: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.object({ ts: z.number().int(), id: z.string() }).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const { definition, environment } = await resolveFlagAndEnvironment(
      context,
      input.teamId,
      input.flagKey,
      input.environmentKey,
    )
    const identityFilters = [
      eq(flagIdentityOverride.flagId, definition.id),
      eq(flagIdentityOverride.environmentId, environment.id),
    ]
    if (input.cursor) {
      const at = new Date(input.cursor.ts)
      identityFilters.push(
        or(
          lt(flagIdentityOverride.createdAt, at),
          and(
            eq(flagIdentityOverride.createdAt, at),
            lt(flagIdentityOverride.id, input.cursor.id),
          ),
        )!,
      )
    }
    const [segments, identityRows] = await Promise.all([
      // Segments only on the first page — they don't paginate.
      input.cursor
        ? Promise.resolve([])
        : context.db
            .select()
            .from(flagSegmentOverride)
            .where(
              and(
                eq(flagSegmentOverride.flagId, definition.id),
                eq(flagSegmentOverride.environmentId, environment.id),
              ),
            ),
      context.db
        .select()
        .from(flagIdentityOverride)
        .where(and(...identityFilters))
        .orderBy(
          desc(flagIdentityOverride.createdAt),
          desc(flagIdentityOverride.id),
        )
        .limit(input.limit + 1),
    ])
    const identities = identityRows.slice(0, input.limit)
    const last = identities[identities.length - 1]
    const nextCursor =
      identityRows.length > input.limit && last
        ? { ts: last.createdAt.getTime(), id: last.id }
        : null
    return { segments, identities, nextCursor }
  })

// Debugger: full evaluation WITH source attribution.
const testEvaluate = base
  .input(
    z.object({
      teamId: z.string(),
      environmentKey: z.string(),
      identityKey: z.string(),
      traits: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const flags = await evaluateFlags(
      context.db,
      input.teamId,
      input.environmentKey,
      input.identityKey,
      input.traits,
    )
    return { flags }
  })

export const flagsAdminRouter = {
  listEnvironments,
  createEnvironment,
  listFlags,
  createFlag,
  deleteFlag,
  setState,
  setSegmentOverride,
  removeSegmentOverride,
  setIdentityOverride,
  removeIdentityOverride,
  listOverrides,
  testEvaluate,
}
