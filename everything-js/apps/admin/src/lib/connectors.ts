import { createServerFn } from "@tanstack/react-start"
import { eq, and } from "drizzle-orm"

import { authMiddleware } from "@/lib/auth/middleware"
import { connector } from "@/lib/db/schema"
import {
  OM_EVENTS_DDL,
  assertTeamMember,
  clickHouseQuery,
  decryptConfig,
  encryptConfig,
  readClickHouseRow,
} from "@/lib/connectors-host"

// Per-team external backends. Credentials are symmetrically encrypted
// with the auth secret before hitting D1 and are NEVER returned by any
// API after creation — list/test only expose non-secret fields.
//
// The helpers come from connectors-host.ts as environment functions
// (createServerOnlyFn) — TanStack Start's compiler strips their
// implementations from client bundles, so these static imports are
// client-safe.

export const listTeamConnectors = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data: { teamId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertTeamMember(context.db, context.session.user.id, data.teamId)
    const row = await readClickHouseRow(context.db, data.teamId)
    if (!row) return { clickhouse: null }
    const config = await decryptConfig(row.config)
    return {
      clickhouse: {
        id: row.id,
        enabled: row.enabled,
        url: config.url,
        database: config.database,
        username: config.username,
        // Never the password — only whether one is set.
        hasPassword: config.password.length > 0,
        updatedAt: row.updatedAt,
      },
    }
  })

export const saveClickHouseConnector = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (data: {
      teamId: string
      url: string
      database: string
      username: string
      // Omitted on update = keep the stored password.
      password?: string
      enabled: boolean
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertTeamMember(context.db, context.session.user.id, data.teamId)
    if (!/^https?:\/\//.test(data.url)) {
      throw new Error("URL must start with http:// or https://")
    }
    if (!/^[A-Za-z0-9_]+$/.test(data.database)) {
      throw new Error("Database name must be alphanumeric/underscore")
    }

    const existing = await readClickHouseRow(context.db, data.teamId)
    let password = data.password ?? ""
    if (!data.password && existing) {
      password = (await decryptConfig(existing.config)).password
    }

    const encrypted = await encryptConfig({
      url: data.url,
      database: data.database,
      username: data.username,
      password,
    })
    const now = new Date()

    if (existing) {
      await context.db
        .update(connector)
        .set({ config: encrypted, enabled: data.enabled, updatedAt: now })
        .where(eq(connector.id, existing.id))
    } else {
      await context.db.insert(connector).values({
        id: crypto.randomUUID(),
        teamId: data.teamId,
        type: "clickhouse",
        config: encrypted,
        enabled: data.enabled,
        createdAt: now,
        updatedAt: now,
      })
    }
    return { success: true }
  })

export const deleteClickHouseConnector = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { teamId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertTeamMember(context.db, context.session.user.id, data.teamId)
    await context.db
      .delete(connector)
      .where(
        and(
          eq(connector.teamId, data.teamId),
          eq(connector.type, "clickhouse"),
        ),
      )
    return { success: true }
  })

// Test + initialize: ping, create database and the om_events table.
export const testClickHouseConnector = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { teamId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertTeamMember(context.db, context.session.user.id, data.teamId)
    const row = await readClickHouseRow(context.db, data.teamId)
    if (!row) return { ok: false as const, error: "No connector saved" }
    const config = await decryptConfig(row.config)

    const ping = await clickHouseQuery(config, "SELECT version()")
    if (!ping.ok) return { ok: false as const, error: ping.body }

    const createDb = await clickHouseQuery(
      config,
      `CREATE DATABASE IF NOT EXISTS ${config.database}`,
    )
    if (!createDb.ok) return { ok: false as const, error: createDb.body }

    const createTable = await clickHouseQuery(
      config,
      OM_EVENTS_DDL(config.database),
    )
    if (!createTable.ok) return { ok: false as const, error: createTable.body }

    return { ok: true as const, version: ping.body.trim() }
  })
