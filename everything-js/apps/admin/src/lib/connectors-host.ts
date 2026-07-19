// Server-only connector internals. Imported by server-function
// handlers and module host glue ONLY — never from client-reachable
// code (it touches cloudflare:workers and decrypted secrets).
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

export async function assertTeamMember(
  db: Db,
  userId: string,
  teamId: string,
) {
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
}

export async function readClickHouseRow(db: Db, teamId: string) {
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
}

export async function decryptConfig(config: string): Promise<ClickHouseConfig> {
  return JSON.parse(
    await symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: config }),
  )
}

export async function encryptConfig(config: ClickHouseConfig): Promise<string> {
  return symmetricEncrypt({
    key: env.BETTER_AUTH_SECRET,
    data: JSON.stringify(config),
  })
}

// Host-side lookup used by module mounting (lib/modules/meter.ts): the
// connector decision point. Returns null → the team stays on D1.
export async function getClickHouseConfig(
  db: Db,
  teamId: string,
): Promise<ClickHouseConfig | null> {
  const row = await readClickHouseRow(db, teamId)
  if (!row || !row.enabled) return null
  return decryptConfig(row.config)
}

export const OM_EVENTS_DDL = (database: string) =>
  // Mirrors OpenMeter's om_events; ReplacingMergeTree keyed on the
  // dedup identity (namespace, source, id) — queries read with FINAL.
  `CREATE TABLE IF NOT EXISTS ${database}.om_events (` +
  `namespace String, id String, type LowCardinality(String), ` +
  `subject String, source String, time DateTime, data String, ` +
  `ingested_at DateTime` +
  `) ENGINE = ReplacingMergeTree ORDER BY (namespace, source, id)`

export async function clickHouseQuery(
  config: ClickHouseConfig,
  query: string,
): Promise<{ ok: boolean; body: string }> {
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
}
