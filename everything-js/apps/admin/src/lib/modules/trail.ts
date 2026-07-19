import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  trailAdminRouter,
  trailConsumerRouter,
  type TrailAdminContext,
  type TrailConsumerContext,
} from "@open-context/module-trail"

import { adminCallContext, consumerCallContext } from "./host"

const adminHandler = new RPCHandler(trailAdminRouter)

export async function handleTrailAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: TrailAdminContext = ctx
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/trail/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

const consumerHandler = new OpenAPIHandler(trailConsumerRouter)

export async function handleTrailConsumer(request: Request, env: Env) {
  const ctx = await consumerCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: TrailConsumerContext = ctx
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/trail/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
