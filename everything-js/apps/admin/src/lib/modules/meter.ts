import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  createClickHouseEventStore,
  createD1EventStore,
  meterAdminRouter,
  meterConsumerRouter,
  type EventStore,
  type MeterAdminContext,
  type MeterConsumerContext,
} from "@open-context/module-meter"

import { getClickHouseConfig } from "../connectors-host"
import { getDb } from "../auth/middleware"
import { adminCallContext, consumerCallContext } from "./host"

// The connector decision point: a team with an enabled clickhouse
// connector gets a ClickHouse store, everyone else stays on D1. The
// module never knows which. Async because it reads (and decrypts) the
// team's connector row.
async function storeForTeam(
  db: ReturnType<typeof getDb>,
  teamId: string,
): Promise<EventStore> {
  const clickhouse = await getClickHouseConfig(db, teamId)
  if (clickhouse) return createClickHouseEventStore(clickhouse, teamId)
  return createD1EventStore(db, teamId)
}

const adminHandler = new RPCHandler(meterAdminRouter)

export async function handleMeterAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  // Per-request memo so repeated storeFor calls don't re-read the
  // connector row.
  const memo = new Map<string, Promise<EventStore>>()
  const storeFor = (teamId: string) => {
    let store = memo.get(teamId)
    if (!store) {
      store = storeForTeam(ctx.db, teamId)
      memo.set(teamId, store)
    }
    return store
  }

  const context: MeterAdminContext = {
    ...ctx,
    storeFor,
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
    store: await storeForTeam(ctx.db, ctx.teamId),
  }
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/meter/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
