import { os } from "@orpc/server"
import { z } from "zod"

import type { IdentityConsumerContext } from "./context"
import { identityInSegments } from "../segments/store"
import { createPortalToken } from "../portal/tokens"
import {
  attachIdentityToGroup,
  getMergedProperties,
  upsertGroup,
  upsertIdentity,
} from "./store"

const base = os.$context<IdentityConsumerContext>()

const opsSchema = {
  set: z.record(z.string(), z.unknown()).optional(),
  setOnce: z.record(z.string(), z.unknown()).optional(),
  unset: z.array(z.string()).optional(),
  increment: z.record(z.string(), z.number()).optional(),
}

const keySchema = z.string().min(1).max(200)

// POST /api/identity/v1/identify — upsert an identity and apply
// property ops. Identity = any principal (person, service account,
// device); id is deterministic uuidv5(teamId:key).
const identify = base
  .route({ method: "POST", path: "/identify" })
  .input(z.object({ identity: keySchema, ...opsSchema }))
  .handler(async ({ input, context }) => {
    const result = await upsertIdentity(
      context.db,
      context.teamId,
      input.identity,
      {
        set: input.set,
        setOnce: input.setOnce,
        unset: input.unset,
        increment: input.increment,
      },
    )
    return { id: result.id, properties: result.properties }
  })

// POST /api/identity/v1/group — upsert a group and apply property ops.
const group = base
  .route({ method: "POST", path: "/group" })
  .input(z.object({ group: keySchema, ...opsSchema }))
  .handler(async ({ input, context }) => {
    const result = await upsertGroup(context.db, context.teamId, input.group, {
      set: input.set,
      setOnce: input.setOnce,
      unset: input.unset,
      increment: input.increment,
    })
    return { id: result.id, properties: result.properties }
  })

// POST /api/identity/v1/attach — put an identity in a group (both are
// upserted, so ordering never matters).
const attach = base
  .route({ method: "POST", path: "/attach" })
  .input(z.object({ identity: keySchema, group: keySchema }))
  .handler(({ input, context }) =>
    attachIdentityToGroup(
      context.db,
      context.teamId,
      input.identity,
      input.group,
    ),
  )

// GET /api/identity/v1/identities/{key} — merged view (group props
// under identity props) plus segment memberships; one call gives an
// SDK everything flags/entitlement targeting needs.
const resolve = base
  .route({ method: "GET", path: "/identities/{key}" })
  .input(z.object({ key: keySchema }))
  .handler(async ({ input, context }) => {
    const [merged, segments] = await Promise.all([
      getMergedProperties(context.db, context.teamId, input.key),
      identityInSegments(context.db, context.teamId, input.key),
    ])
    return { ...merged, segments }
  })

// POST /api/identity/v1/portal-tokens — the team's backend mints a
// short-lived scoped token for THEIR logged-in customer; their
// frontend then opens/embeds /portal?token=...
const portalToken = base
  .route({ method: "POST", path: "/portal-tokens" })
  .input(
    z.object({
      identity: keySchema,
      scopes: z
        .array(z.enum(["meter:read", "webhooks:manage"]))
        .min(1)
        .max(4),
      // 1 minute to 7 days; default 1 hour.
      expiresInSeconds: z
        .number()
        .int()
        .min(60)
        .max(7 * 24 * 3600)
        .default(3600),
    }),
  )
  .handler(async ({ input, context }) => {
    const token = await createPortalToken(context.portalSecret, {
      teamId: context.teamId,
      identity: input.identity,
      scopes: input.scopes,
      expiresInSeconds: input.expiresInSeconds,
    })
    return { token, path: `/portal?token=${encodeURIComponent(token)}` }
  })

export const identityConsumerRouter = {
  identify,
  group,
  attach,
  resolve,
  portalToken,
}
