import { ORPCError, os } from "@orpc/server"
import { and, eq } from "drizzle-orm"
import {
  assertValidEndpointUrl,
  coreWebhookEndpoint,
  createWebhookEndpoint,
  deliverDueWebhooks,
  hasDueWebhooks,
  publishWebhook,
} from "@open-context/core"
import { z } from "zod"

import type { WebhooksConsumerContext } from "./context"

const base = os.$context<WebhooksConsumerContext>()

const ownerSchema = {
  // Which of the team's customers this concerns. Omit both for the
  // team's own (platform-notification) endpoints.
  identity: z.string().min(1).max(200).optional(),
  group: z.string().min(1).max(200).optional(),
}

function resolveOwner(input: { identity?: string; group?: string }) {
  if (input.identity && input.group) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Provide identity or group, not both",
    })
  }
  if (input.identity) {
    return { ownerType: "identity" as const, ownerKey: input.identity }
  }
  if (input.group) {
    return { ownerType: "group" as const, ownerKey: input.group }
  }
  return { ownerType: "team" as const, ownerKey: "" }
}

const eventTypeSchema = z
  .string()
  .regex(/^[a-z0-9_.-]+$/i, "letters, digits, . _ -")
  .max(100)

// POST /api/webhooks/v1/send — publish an event to the owner's
// endpoints. First delivery runs via defer (waitUntil) so the caller
// gets an immediate ack; the same deferred pass also sweeps any due
// retries for the team (the no-cron retry path).
const send = base
  .route({ method: "POST", path: "/send" })
  .input(
    z.object({
      ...ownerSchema,
      eventType: eventTypeSchema,
      payload: z.record(z.string(), z.unknown()),
    }),
  )
  .handler(async ({ input, context }) => {
    const owner = resolveOwner(input)
    const result = await publishWebhook(context.db, context.teamId, {
      ...owner,
      eventType: input.eventType,
      payload: input.payload,
    })
    context.defer(deliverDueWebhooks(context.db, context.teamId))
    return result
  })

// ——— Endpoint self-service (for the team's backend to manage on
// behalf of their customers; end-customers use the portal) ———

const createEndpoint = base
  .route({ method: "POST", path: "/endpoints" })
  .input(
    z.object({
      ...ownerSchema,
      url: z.string().max(2000),
      description: z.string().max(500).optional(),
      eventTypes: z.array(eventTypeSchema).max(50).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const invalid = assertValidEndpointUrl(input.url)
    if (invalid) throw new ORPCError("BAD_REQUEST", { message: invalid })
    const owner = resolveOwner(input)
    const endpoint = await createWebhookEndpoint(context.db, context.teamId, {
      ...owner,
      url: input.url,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      eventTypes: input.eventTypes ?? null,
    })
    // Secret is returned on create (and via list) — receivers need it
    // to verify signatures.
    return { endpoint }
  })

const listEndpoints = base
  .route({ method: "GET", path: "/endpoints" })
  .input(z.object(ownerSchema))
  .handler(async ({ input, context }) => {
    const owner = resolveOwner(input)
    const endpoints = await context.db
      .select()
      .from(coreWebhookEndpoint)
      .where(
        and(
          eq(coreWebhookEndpoint.teamId, context.teamId),
          eq(coreWebhookEndpoint.ownerType, owner.ownerType),
          eq(coreWebhookEndpoint.ownerKey, owner.ownerKey),
        ),
      )
    return { endpoints }
  })

const deleteEndpoint = base
  .route({ method: "DELETE", path: "/endpoints/{id}" })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    await context.db
      .delete(coreWebhookEndpoint)
      .where(
        and(
          eq(coreWebhookEndpoint.teamId, context.teamId),
          eq(coreWebhookEndpoint.id, input.id),
        ),
      )
    return { deleted: true }
  })

// POST /api/webhooks/v1/sweep — explicit retry sweep. Also invoked
// opportunistically: any consumer call may defer one of these.
const sweep = base
  .route({ method: "POST", path: "/sweep" })
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    if (!(await hasDueWebhooks(context.db, context.teamId))) {
      return { due: 0, delivered: 0, failed: 0 }
    }
    return deliverDueWebhooks(context.db, context.teamId, 50)
  })

export const webhooksConsumerRouter = {
  send,
  createEndpoint,
  listEndpoints,
  deleteEndpoint,
  sweep,
}
