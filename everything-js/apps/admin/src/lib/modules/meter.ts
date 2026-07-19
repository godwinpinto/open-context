import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  createD1EventStore,
  meterAdminRouter,
  meterConsumerRouter,
  type MeterAdminContext,
  type MeterConsumerContext,
} from "@open-context/module-meter"

import { adminCallContext, consumerCallContext } from "./host"

// Event-store selection happens HERE — this is the future connector
// decision point: when per-team connectors exist, a configured team
// gets a ClickHouse store instead of D1. Modules never know which.

const adminHandler = new RPCHandler(meterAdminRouter)

export async function handleMeterAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: MeterAdminContext = {
    ...ctx,
    storeFor: (teamId) => createD1EventStore(ctx.db, teamId),
  }
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/meter/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

const consumerHandler = new OpenAPIHandler(meterConsumerRouter)

export async function handleMeterConsumer(request: Request, env: Env) {
  const ctx = await consumerCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: MeterConsumerContext = {
    db: ctx.db,
    teamId: ctx.teamId,
    store: createD1EventStore(ctx.db, ctx.teamId),
  }
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/meter/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
