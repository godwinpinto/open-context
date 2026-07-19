import { sql } from "drizzle-orm"

import type { ModuleDatabase } from "./context"
import { SOURCES, SOURCE_BY_NAME } from "./sources"

// Guarded SQL execution. Panel SQL (authored by an LLM over MCP) never
// touches real tables: every allowlisted source it references is
// injected as a CTE pre-filtered to the team and the viewer's time
// range. The guard is belt-and-braces — the CTE sandbox is the real
// isolation, the keyword/table checks just fail fast and loudly.

const MAX_ROWS = 1000

// Real table names + auth tables — panel SQL may never mention them.
const FORBIDDEN_NAMES =
  /\b(trail_event|meter_event|meter_grant|meter_feature|meter_entitlement|meter|oc_identity|oc_group|oc_identity_group|oc_segment|oc_segment_identity|oc_webhook_endpoint|oc_webhook_message|oc_webhook_attempt|exp_experiment|exp_exposure|exp_goal|flag|flag_environment|flag_state|flag_segment_override|flag_identity_override|dash_dashboard|dash_panel|dash_share|connector|user|session|account|apikey|verification|organization|member|invitation|team|organization_role|jwks|oauth_application|oauth_access_token|oauth_consent|device_code|two_factor|sqlite_master|sqlite_temp_master)\b/i

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|reindex|replace|transaction|recursive)\b/i

function stripLiteralsAndComments(input: string): string {
  // Remove string literals and comments so the scans below can't be
  // fooled by table names inside quotes.
  return input
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

export function validatePanelSql(
  rawSql: string,
): { ok: true; referencedSources: string[] } | { ok: false; error: string } {
  const trimmed = rawSql.trim().replace(/;\s*$/, "")
  if (!trimmed) return { ok: false, error: "Empty SQL" }
  if (trimmed.length > 8000) return { ok: false, error: "SQL too long (8000 char max)" }

  const scannable = stripLiteralsAndComments(trimmed)
  if (scannable.includes(";")) {
    return { ok: false, error: "Multiple statements are not allowed" }
  }
  if (!/^\s*(select|with)\b/i.test(scannable)) {
    return { ok: false, error: "Only SELECT (or WITH ... SELECT) queries are allowed" }
  }
  const keyword = scannable.match(FORBIDDEN_KEYWORDS)
  if (keyword) {
    return { ok: false, error: `Forbidden keyword: ${keyword[0]}` }
  }
  const name = scannable.match(FORBIDDEN_NAMES)
  if (name) {
    return {
      ok: false,
      error: `Direct table access is not allowed (${name[0]}). Query the provided sources instead — call listSources for the catalog.`,
    }
  }

  const referencedSources = SOURCES.filter((source) =>
    new RegExp(`\\b${source.name}\\b`, "i").test(scannable),
  ).map((source) => source.name)
  if (referencedSources.length === 0) {
    return {
      ok: false,
      error:
        "Query references no known source. Available: " +
        SOURCES.map((source) => source.name).join(", "),
    }
  }
  return { ok: true, referencedSources }
}

function escapeText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function buildSourceCte(
  sourceName: string,
  teamId: string,
  range: { fromSec: number; toSec: number },
): string {
  const source = SOURCE_BY_NAME.get(sourceName)!
  const selects = source.columns
    .map((column) => {
      const expr = source.select?.[column.name]
      return expr ? `${expr} AS ${column.name}` : column.name
    })
    .join(", ")
  const timeFilter = source.timeColumn
    ? ` AND ${source.timeColumn} >= ${range.fromSec} AND ${source.timeColumn} < ${range.toSec}`
    : ""
  return `${source.name} AS (SELECT ${selects} FROM ${source.table} WHERE team_id = ${escapeText(teamId)}${timeFilter})`
}

export type QueryRange = {
  // Unix MILLISECONDS (converted to stored seconds internally).
  fromMs: number
  toMs: number
}

export function buildGuardedSql(
  rawSql: string,
  teamId: string,
  range: QueryRange,
): { ok: true; sql: string } | { ok: false; error: string } {
  const valid = validatePanelSql(rawSql)
  if (!valid.ok) return valid

  const rangeSec = {
    fromSec: Math.floor(range.fromMs / 1000),
    toSec: Math.ceil(range.toMs / 1000),
  }
  const ctes = valid.referencedSources
    .map((name) => buildSourceCte(name, teamId, rangeSec))
    .join(", ")

  const trimmed = rawSql.trim().replace(/;\s*$/, "")
  // Merge a user-level WITH into ours: `WITH a AS (...) SELECT` becomes
  // `WITH <sources>, a AS (...) SELECT`.
  const full = /^\s*with\b/i.test(trimmed)
    ? `WITH ${ctes}, ${trimmed.replace(/^\s*with\b/i, "")}`
    : `WITH ${ctes} ${trimmed}`
  // SQLite allows WITH inside subqueries, so the row cap wraps cleanly.
  return { ok: true, sql: `SELECT * FROM (${full}) LIMIT ${MAX_ROWS}` }
}

export type QueryResult =
  | { ok: true; columns: string[]; rows: Record<string, unknown>[]; rowCount: number }
  | { ok: false; error: string }

export async function runGuardedQuery(
  db: ModuleDatabase,
  teamId: string,
  rawSql: string,
  range: QueryRange,
): Promise<QueryResult> {
  const built = buildGuardedSql(rawSql, teamId, range)
  if (!built.ok) return built
  try {
    const rows = (await db.all(sql.raw(built.sql))) as Record<string, unknown>[]
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : []
    return { ok: true, columns, rows, rowCount: rows.length }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Query failed",
    }
  }
}
