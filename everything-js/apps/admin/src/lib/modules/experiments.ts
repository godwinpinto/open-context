import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  experimentsAdminRouter,
  experimentsConsumerRouter,
  type ExperimentsAdminContext,
  type ExperimentsConsumerContext,
} from "@open-context/module-experiments"

import { adminCallContext, consumerCallContext } from "./host"

const adminHandler = new RPCHandler(experimentsAdminRouter)

export async function handleExperimentsAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: ExperimentsAdminContext = ctx
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/experiments/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

const consumerHandler = new OpenAPIHandler(experimentsConsumerRouter)

export async function handleExperimentsConsumer(request: Request, env: Env) {
  const ctx = await consumerCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: ExperimentsConsumerContext = ctx
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/experiments/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
