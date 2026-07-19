import { and, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

import { meterEvent } from "./schema"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = DrizzleD1Database<any>

export type Aggregation =
  | "sum"
  | "count"
  | "unique_count"
  | "avg"
  | "min"
  | "max"

export type WindowSize = "hour" | "day" | "month"

export type InsertEventInput = {
  id: string
  type: string
  subject: string
  source: string
  time: Date
  data: Record<string, unknown> | null
}

export type AggregateParams = {
  eventType: string
  aggregation: Aggregation
  valueProperty: string | null
  from: Date
  to: Date
  subject?: string
  windowSize?: WindowSize
  // One dimension: { name, path } from the meter's groupBy map.
  groupBy?: { name: string; path: string }
}

export type AggregateRow = {
  windowStart: Date
  windowEnd: Date
  subject: string | null
  group: string | null
  value: number
}

export type ListParams = {
  limit: number
  type?: string
  subject?: string
  // Keyset cursor: rows strictly older than (time desc, id desc).
  // ts is epoch ms.
  cursor?: { ts: number; id: string }
}

export type StoredEvent = typeof meterEvent.$inferSelect

// All event reads/writes go through this interface. Today the only
// implementation is D1; when per-team connectors land, a ClickHouse
// store implements the same surface and the host picks per team.
export type EventStore = {
  insert(events: InsertEventInput[]): Promise<{ accepted: number }>
  aggregate(params: AggregateParams): Promise<AggregateRow[]>
  list(params: ListParams): Promise<StoredEvent[]>
}

const WINDOW_FORMATS: Record<WindowSize, string> = {
  hour: "%Y-%m-%dT%H:00:00Z",
  day: "%Y-%m-%dT00:00:00Z",
  month: "%Y-%m-01T00:00:00Z",
}

function windowEnd(start: Date, size: WindowSize): Date {
  const end = new Date(start)
  if (size === "hour") end.setUTCHours(end.getUTCHours() + 1)
  else if (size === "day") end.setUTCDate(end.getUTCDate() + 1)
  else end.setUTCMonth(end.getUTCMonth() + 1)
  return end
}

export function createD1EventStore(db: Database, teamId: string): EventStore {
  return {
    async insert(events) {
      if (events.length === 0) return { accepted: 0 }
      const now = new Date()
      const rows = events.map((event) => ({
        storeRowId: crypto.randomUUID(),
        teamId,
        id: event.id,
        type: event.type,
        subject: event.subject,
        source: event.source,
        time: event.time,
        data: event.data,
        ingestedAt: now,
      }))
      // Dedup on (teamId, source, id): retries and replays are no-ops.
      await db.insert(meterEvent).values(rows).onConflictDoNothing()
      return { accepted: rows.length }
    },

    async aggregate(params) {
      const path = params.valueProperty ?? "$.value"
      const agg = params.aggregation
      const valueExpr =
        agg === "count"
          ? sql<number>`COUNT(*)`
          : agg === "unique_count"
            ? sql<number>`COUNT(DISTINCT json_extract(${meterEvent.data}, ${path}))`
            : sql<number>`${sql.raw(agg.toUpperCase())}(CAST(json_extract(${meterEvent.data}, ${path}) AS REAL))`

      const filters: SQL[] = [
        eq(meterEvent.teamId, teamId),
        eq(meterEvent.type, params.eventType),
        gte(meterEvent.time, params.from),
        lt(meterEvent.time, params.to),
      ]
      if (params.subject) filters.push(eq(meterEvent.subject, params.subject))

      const bucketExpr = params.windowSize
        ? sql<string>`strftime(${WINDOW_FORMATS[params.windowSize]}, ${meterEvent.time}, 'unixepoch')`
        : sql<string>`'window'`
      const groupExpr = params.groupBy
        ? sql<string>`json_extract(${meterEvent.data}, ${params.groupBy.path})`
        : sql<string>`NULL`
      const subjectExpr = params.subject
        ? sql<string>`${meterEvent.subject}`
        : sql<string>`NULL`

      const groupings: SQL[] = []
      if (params.windowSize) groupings.push(bucketExpr)
      if (params.groupBy) groupings.push(groupExpr)
      if (params.subject) groupings.push(subjectExpr)

      let query = db
        .select({
          bucket: bucketExpr,
          subject: subjectExpr,
          group: groupExpr,
          value: valueExpr,
        })
        .from(meterEvent)
        .where(and(...filters))
        .$dynamic()
      if (groupings.length > 0) {
        query = query.groupBy(...groupings)
      }
      const rows = await query

      return rows.map((row) => {
        const windowStart = params.windowSize
          ? new Date(row.bucket)
          : params.from
        return {
          windowStart,
          windowEnd: params.windowSize
            ? windowEnd(windowStart, params.windowSize)
            : params.to,
          subject: row.subject ?? null,
          group: row.group == null ? null : String(row.group),
          value: row.value ?? 0,
        }
      })
    },

    async list(params) {
      const filters: SQL[] = [eq(meterEvent.teamId, teamId)]
      if (params.type) filters.push(eq(meterEvent.type, params.type))
      if (params.subject) filters.push(eq(meterEvent.subject, params.subject))
      if (params.cursor) {
        const at = new Date(params.cursor.ts)
        filters.push(
          or(
            lt(meterEvent.time, at),
            and(eq(meterEvent.time, at), lt(meterEvent.id, params.cursor.id)),
          )!,
        )
      }
      return db
        .select()
        .from(meterEvent)
        .where(and(...filters))
        .orderBy(desc(meterEvent.time), desc(meterEvent.id))
        .limit(params.limit)
    },
  }
}
