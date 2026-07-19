import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  webhooksAdminRouter,
  webhooksConsumerRouter,
  type WebhooksAdminContext,
  type WebhooksConsumerContext,
} from "@open-context/module-webhooks"

import { adminCallContext, consumerCallContext } from "./host"

// Background scheduler for webhook deliveries: ctx.waitUntil when the
// runtime exposes it (workerd's cloudflare:workers module-level
// export), otherwise fire-and-forget — either way the API response
// never blocks on receiver endpoints.
async function makeDefer(): Promise<(work: Promise<unknown>) => void> {
  try {
    const workers = (await import("cloudflare:workers")) as {
      waitUntil?: (promise: Promise<unknown>) => void
    }
    if (typeof workers.waitUntil === "function") {
      return (work) => workers.waitUntil!(work.catch(() => {}))
    }
  } catch {
    // Not on workerd (e.g. plain Node) — fall through.
  }
  return (work) => void work.catch(() => {})
}

const adminHandler = new RPCHandler(webhooksAdminRouter)

export async function handleWebhooksAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: WebhooksAdminContext = ctx
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/webhooks/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

const consumerHandler = new OpenAPIHandler(webhooksConsumerRouter)

export async function handleWebhooksConsumer(request: Request, env: Env) {
  const ctx = await consumerCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: WebhooksConsumerContext = {
    db: ctx.db,
    teamId: ctx.teamId,
    defer: await makeDefer(),
  }
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/webhooks/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
