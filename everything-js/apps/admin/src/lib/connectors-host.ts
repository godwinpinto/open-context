// Server-only connector internals (secrets, cloudflare:workers env).
// Every export is wrapped in createServerOnlyFn — TanStack Start's
// environment-function compiler strips the implementations (and their
// imports) from client bundles, so importing this module from
// client-reachable code is safe by construction; calling one of these
// on the client throws.
import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto"
import { and, eq } from "drizzle-orm"

import * as schema from "@/lib/db/schema"
import type { getDb } from "@/lib/auth/middleware"

export type ClickHouseConfig = {
  url: string
  database: string
  username: string
  password: string
}

export type Db = ReturnType<typeof getDb>

export const assertTeamMember = createServerOnlyFn(
  async (db: Db, userId: string, teamId: string) => {
    const [team] = await db
      .select({ organizationId: schema.team.organizationId })
      .from(schema.team)
      .where(eq(schema.team.id, teamId))
    const [membership] = team
      ? await db
          .select({ id: schema.member.id })
          .from(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, team.organizationId),
              eq(schema.member.userId, userId),
            ),
          )
      : []
    if (!membership) throw new Error("Not a member of this team")
  },
)

export const readClickHouseRow = createServerOnlyFn(
  async (db: Db, teamId: string) => {
    const [row] = await db
      .select()
      .from(schema.connector)
      .where(
        and(
          eq(schema.connector.teamId, teamId),
          eq(schema.connector.type, "clickhouse"),
        ),
      )
    return row
  },
)

export const decryptConfig = createServerOnlyFn(
  async (config: string): Promise<ClickHouseConfig> =>
    JSON.parse(
      await symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: config }),
    ),
)

export const encryptConfig = createServerOnlyFn(
  (config: ClickHouseConfig): Promise<string> =>
    symmetricEncrypt({
      key: env.BETTER_AUTH_SECRET,
      data: JSON.stringify(config),
    }),
)

// Host-side lookup used by module mounting (lib/modules/meter.ts): the
// connector decision point. Returns null → the team stays on D1.
export const getClickHouseConfig = createServerOnlyFn(
  async (db: Db, teamId: string): Promise<ClickHouseConfig | null> => {
    const row = await readClickHouseRow(db, teamId)
    if (!row || !row.enabled) return null
    return decryptConfig(row.config)
  },
)

export const OM_EVENTS_DDL = createServerOnlyFn(
  (database: string) =>
    // Mirrors OpenMeter's om_events; ReplacingMergeTree keyed on the
    // dedup identity (namespace, source, id) — queries read with FINAL.
    `CREATE TABLE IF NOT EXISTS ${database}.om_events (` +
    `namespace String, id String, type LowCardinality(String), ` +
    `subject String, source String, time DateTime, data String, ` +
    `ingested_at DateTime` +
    `) ENGINE = ReplacingMergeTree ORDER BY (namespace, source, id)`,
)

export const clickHouseQuery = createServerOnlyFn(
  async (
    config: ClickHouseConfig,
    query: string,
  ): Promise<{ ok: boolean; body: string }> => {
    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "X-ClickHouse-User": config.username,
          "X-ClickHouse-Key": config.password,
        },
        body: query,
        signal: AbortSignal.timeout(5000),
      })
      return { ok: response.ok, body: (await response.text()).slice(0, 300) }
    } catch (error) {
      return { ok: false, body: (error as Error).message }
    }
  },
)
