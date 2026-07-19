import { ORPCError, os } from "@orpc/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import type { IdentityAdminContext } from "../identity/context"
import { coreIdentity } from "../identity/schema"
import { getMergedProperties, upsertIdentity } from "../identity/store"
import { explainRules, type SegmentRules } from "./rules"
import { coreSegment, coreSegmentIdentity } from "./schema"
import {
  previewDynamicMembers,
  resolveIdentityId,
  segmentId,
} from "./store"

const base = os.$context<IdentityAdminContext>()

const conditionSchema = z.union([
  z.object({
    type: z.literal("property"),
    property: z.string().min(1).max(200),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "is_set",
      "is_not_set",
      "regex",
    ]),
    value: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("split"),
    percentage: z.number().min(0).max(100),
  }),
])

const rulesSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(conditionSchema).min(1).max(20),
})

const listSegments = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const segments = await context.db
      .select()
      .from(coreSegment)
      .where(eq(coreSegment.teamId, input.teamId))
      .orderBy(desc(coreSegment.createdAt))
    return { segments }
  })

const createSegment = base
  .input(
    z.object({
      teamId: z.string(),
      key: z
        .string()
        .regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, - and _")
        .max(64),
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      type: z.enum(["dynamic", "manual"]),
      rules: rulesSchema.optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    if (input.type === "dynamic" && !input.rules) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Dynamic segments need rules",
      })
    }
    const now = new Date()
    const row = {
      id: await segmentId(input.teamId, input.key),
      teamId: input.teamId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      rules: input.type === "dynamic" ? (input.rules as SegmentRules) : null,
      createdAt: now,
      updatedAt: now,
    }
    await context.db.insert(coreSegment).values(row)
    return { segment: row }
  })

const updateSegmentRules = base
  .input(
    z.object({
      teamId: z.string(),
      segmentKey: z.string(),
      rules: rulesSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .update(coreSegment)
      .set({ rules: input.rules as SegmentRules, updatedAt: new Date() })
      .where(
        and(
          eq(coreSegment.teamId, input.teamId),
          eq(coreSegment.key, input.segmentKey),
          eq(coreSegment.type, "dynamic"),
        ),
      )
    return { success: true }
  })

const deleteSegment = base
  .input(z.object({ teamId: z.string(), segmentKey: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const id = await segmentId(input.teamId, input.segmentKey)
    await context.db
      .delete(coreSegmentIdentity)
      .where(eq(coreSegmentIdentity.segmentId, id))
    await context.db
      .delete(coreSegment)
      .where(
        and(eq(coreSegment.teamId, input.teamId), eq(coreSegment.id, id)),
      )
    return { success: true }
  })

// Manual membership — accepts identity keys OR uuids (interchangeable
// thanks to deterministic IDs). Unknown keys are upserted so a manual
// segment can be seeded before the identities first appear.
const addManualMembers = base
  .input(
    z.object({
      teamId: z.string(),
      segmentKey: z.string(),
      members: z.array(z.string().min(1).max(200)).min(1).max(200),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const id = await segmentId(input.teamId, input.segmentKey)
    const [segment] = await context.db
      .select()
      .from(coreSegment)
      .where(eq(coreSegment.id, id))
    if (!segment || segment.type !== "manual") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Not a manual segment",
      })
    }
    const now = new Date()
    for (const member of input.members) {
      // Keys (non-uuid input) get the identity upserted; raw uuids are
      // trusted as-is.
      const isUuid = /^[0-9a-f-]{36}$/i.test(member)
      const identityId = isUuid
        ? member.toLowerCase()
        : (await upsertIdentity(context.db, input.teamId, member, {})).id
      await context.db
        .insert(coreSegmentIdentity)
        .values({
          teamId: input.teamId,
          segmentId: id,
          identityId,
          createdAt: now,
        })
        .onConflictDoNothing()
    }
    return { success: true }
  })

const removeManualMember = base
  .input(
    z.object({
      teamId: z.string(),
      segmentKey: z.string(),
      member: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const id = await segmentId(input.teamId, input.segmentKey)
    const identityId = await resolveIdentityId(input.teamId, input.member)
    await context.db
      .delete(coreSegmentIdentity)
      .where(
        and(
          eq(coreSegmentIdentity.segmentId, id),
          eq(coreSegmentIdentity.identityId, identityId),
        ),
      )
    return { success: true }
  })

const listMembers = base
  .input(
    z.object({
      teamId: z.string(),
      segmentKey: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const id = await segmentId(input.teamId, input.segmentKey)
    const [segment] = await context.db
      .select()
      .from(coreSegment)
      .where(eq(coreSegment.id, id))
    if (!segment) throw new ORPCError("NOT_FOUND", { message: "No such segment" })

    if (segment.type === "manual") {
      const members = await context.db
        .select({
          key: coreIdentity.key,
          properties: coreIdentity.properties,
        })
        .from(coreSegmentIdentity)
        .innerJoin(
          coreIdentity,
          eq(coreSegmentIdentity.identityId, coreIdentity.id),
        )
        .where(eq(coreSegmentIdentity.segmentId, id))
        .limit(input.limit)
      return { members, type: "manual" as const }
    }

    if (!segment.rules) return { members: [], type: "dynamic" as const }
    const members = await previewDynamicMembers(
      context.db,
      input.teamId,
      { id: segment.id, rules: segment.rules },
      input.limit,
    )
    return { members, type: "dynamic" as const }
  })

// Debugger: which conditions pass/fail for a given identity?
const testIdentity = base
  .input(
    z.object({
      teamId: z.string(),
      segmentKey: z.string(),
      identityKey: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const id = await segmentId(input.teamId, input.segmentKey)
    const [segment] = await context.db
      .select()
      .from(coreSegment)
      .where(eq(coreSegment.id, id))
    if (!segment) throw new ORPCError("NOT_FOUND", { message: "No such segment" })

    if (segment.type === "manual") {
      const identityId = await resolveIdentityId(input.teamId, input.identityKey)
      const [membership] = await context.db
        .select()
        .from(coreSegmentIdentity)
        .where(
          and(
            eq(coreSegmentIdentity.segmentId, id),
            eq(coreSegmentIdentity.identityId, identityId),
          ),
        )
      return { matched: !!membership, conditions: [], properties: {} }
    }

    const merged = await getMergedProperties(
      context.db,
      input.teamId,
      input.identityKey,
    )
    const result = explainRules(
      segment.rules!,
      merged.properties,
      input.identityKey,
      segment.id,
    )
    return { ...result, properties: merged.properties }
  })

export const segmentsAdminRouter = {
  listSegments,
  createSegment,
  updateSegmentRules,
  deleteSegment,
  addManualMembers,
  removeManualMember,
  listMembers,
  testIdentity,
}
