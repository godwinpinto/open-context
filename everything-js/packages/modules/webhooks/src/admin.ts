import { ORPCError, os } from "@orpc/server"
import { and, desc, eq, inArray, lt, or } from "drizzle-orm"
import {
  assertValidEndpointUrl,
  coreWebhookAttempt,
  coreWebhookEndpoint,
  coreWebhookMessage,
  createWebhookEndpoint,
  deliverDueWebhooks,
  replayWebhookMessage,
  rotateWebhookSecret,
} from "@open-context/core"
import { z } from "zod"

import type { WebhooksAdminContext } from "./context"

const base = os.$context<WebhooksAdminContext>()

const ownerTypeSchema = z.enum(["team", "identity", "group"])

const listEndpoints = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const endpoints = await context.db
      .select()
      .from(coreWebhookEndpoint)
      .where(eq(coreWebhookEndpoint.teamId, input.teamId))
      .orderBy(desc(coreWebhookEndpoint.createdAt))
    return { endpoints }
  })

const createEndpoint = base
  .input(
    z.object({
      teamId: z.string(),
      ownerType: ownerTypeSchema,
      ownerKey: z.string().max(200).optional(),
      url: z.string().max(2000),
      description: z.string().max(500).optional(),
      eventTypes: z.array(z.string().max(100)).max(50).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const invalid = assertValidEndpointUrl(input.url)
    if (invalid) throw new ORPCError("BAD_REQUEST", { message: invalid })
    if (input.ownerType !== "team" && !input.ownerKey) {
      throw new ORPCError("BAD_REQUEST", {
        message: "ownerKey is required for identity/group endpoints",
      })
    }
    const endpoint = await createWebhookEndpoint(context.db, input.teamId, {
      ownerType: input.ownerType,
      ...(input.ownerKey !== undefined ? { ownerKey: input.ownerKey } : {}),
      url: input.url,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      eventTypes: input.eventTypes ?? null,
    })
    return { endpoint }
  })

const setEndpointDisabled = base
  .input(
    z.object({ teamId: z.string(), id: z.string(), disabled: z.boolean() }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .update(coreWebhookEndpoint)
      .set({
        disabled: input.disabled,
        disabledReason: input.disabled ? "Disabled from dashboard" : null,
        // Re-enabling gives the endpoint a clean slate.
        ...(input.disabled ? {} : { consecutiveFailures: 0 }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(coreWebhookEndpoint.teamId, input.teamId),
          eq(coreWebhookEndpoint.id, input.id),
        ),
      )
    return { ok: true }
  })

const deleteEndpoint = base
  .input(z.object({ teamId: z.string(), id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await context.db
      .delete(coreWebhookEndpoint)
      .where(
        and(
          eq(coreWebhookEndpoint.teamId, input.teamId),
          eq(coreWebhookEndpoint.id, input.id),
        ),
      )
    return { ok: true }
  })

const rotateSecret = base
  .input(z.object({ teamId: z.string(), id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const secret = await rotateWebhookSecret(context.db, input.teamId, input.id)
    return { secret }
  })

// Recent messages with their delivery attempts, newest first.
// Keyset cursor: (createdAt desc, id desc); ts is epoch ms.
const listMessages = base
  .input(
    z.object({
      teamId: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.object({ ts: z.number().int(), id: z.string() }).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    const filters = [eq(coreWebhookMessage.teamId, input.teamId)]
    if (input.cursor) {
      const at = new Date(input.cursor.ts)
      filters.push(
        or(
          lt(coreWebhookMessage.createdAt, at),
          and(
            eq(coreWebhookMessage.createdAt, at),
            lt(coreWebhookMessage.id, input.cursor.id),
          ),
        )!,
      )
    }
    const rows = await context.db
      .select()
      .from(coreWebhookMessage)
      .where(and(...filters))
      .orderBy(desc(coreWebhookMessage.createdAt), desc(coreWebhookMessage.id))
      .limit(input.limit + 1)
    const messages = rows.slice(0, input.limit)
    const last = messages[messages.length - 1]
    const nextCursor =
      rows.length > input.limit && last
        ? { ts: last.createdAt.getTime(), id: last.id }
        : null
    const messageIds = messages.map((message) => message.id)
    const attempts = messageIds.length
      ? await context.db
          .select()
          .from(coreWebhookAttempt)
          .where(inArray(coreWebhookAttempt.messageId, messageIds))
          .orderBy(desc(coreWebhookAttempt.updatedAt))
      : []
    return { messages, attempts, nextCursor }
  })

// Manual "deliver now": runs the same sweep the consumer traffic
// piggybacks — the dashboard's replacement for a cron.
const deliverNow = base
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    return deliverDueWebhooks(context.db, input.teamId, 50)
  })

const replay = base
  .input(
    z.object({ teamId: z.string(), messageId: z.string(), endpointId: z.string() }),
  )
  .handler(async ({ input, context }) => {
    await context.assertTeamAccess(input.teamId)
    await replayWebhookMessage(
      context.db,
      input.teamId,
      input.messageId,
      input.endpointId,
    )
    const result = await deliverDueWebhooks(context.db, input.teamId)
    return { ok: true, ...result }
  })

export const webhooksAdminRouter = {
  listEndpoints,
  createEndpoint,
  setEndpointDisabled,
  deleteEndpoint,
  rotateSecret,
  listMessages,
  deliverNow,
  replay,
}
