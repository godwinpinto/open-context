import { RPCHandler } from "@orpc/server/fetch"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import {
  flagsAdminRouter,
  flagsConsumerRouter,
  type FlagsAdminContext,
  type FlagsConsumerContext,
} from "@open-context/module-flags"

import { adminCallContext, consumerCallContext } from "./host"

const adminHandler = new RPCHandler(flagsAdminRouter)

export async function handleFlagsAdmin(request: Request, env: Env) {
  const ctx = await adminCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: FlagsAdminContext = ctx
  const { matched, response } = await adminHandler.handle(request, {
    prefix: "/api/flags/admin",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}

const consumerHandler = new OpenAPIHandler(flagsConsumerRouter)

export async function handleFlagsConsumer(request: Request, env: Env) {
  const ctx = await consumerCallContext(request, env)
  if (ctx instanceof Response) return ctx

  const context: FlagsConsumerContext = {
    db: ctx.db,
    teamId: ctx.teamId,
    // A key IS an environment key (Flagsmith model) — production when
    // unspecified.
    environmentKey:
      typeof ctx.keyMetadata.environment === "string"
        ? ctx.keyMetadata.environment
        : "production",
  }
  const { matched, response } = await consumerHandler.handle(request, {
    prefix: "/api/flags/v1",
    context,
  })
  if (matched) return response
  return Response.json({ error: "Not found" }, { status: 404 })
}
