import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  identityAdminRouter,
  identityConsumerRouter,
  type IdentityAdminContext,
  type IdentityConsumerContext,
} from "@open-context/core"

import { adminCallContext, consumerCallContext } from "./host"

// Identity is CORE, not a module — it mounts with the same host glue
// for uniformity, but modules depend on it (via @open-context/core
// imports), never the other way around.

const adminHandler = new RPCHandler(identityAdminRouter)

export async function handleIdentityAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: IdentityAdminContext = ctx
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/identity/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

const consumerHandler = new OpenAPIHandler(identityConsumerRouter)

export async function handleIdentityConsumer(request: Request, env: Env) {
  const ctx = await consumerCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: IdentityConsumerContext = ctx
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/identity/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
