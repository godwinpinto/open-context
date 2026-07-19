import type {
  AggregateParams,
  AggregateRow,
  EventStore,
  InsertEventInput,
  ListParams,
  StoredEvent,
  WindowSize,
} from "./store"

// ClickHouse implementation of EventStore over the HTTP interface —
// selected by the host when a team has a clickhouse connector
// configured. Same table shape as D1's meter_event (both mirror
// OpenMeter's om_events); dedup via ReplacingMergeTree on
// (namespace, source, id), so reads use FINAL.

export type ClickHouseStoreConfig = {
  url: string
  database: string
  username: string
  password: string
}

const BUCKET_FN: Record<WindowSize, string> = {
  hour: "toStartOfHour",
  day: "toStartOfDay",
  month: "toStartOfMonth",
}

// "$.a.b" -> ClickHouse JSONExtract key list: 'a', 'b'. Paths are
// validated at meter creation (^\$\.[A-Za-z0-9_.]+$), so quoting the
// segments inline is safe.
function pathKeys(path: string): string {
  return path
    .replace(/^\$\./, "")
    .split(".")
    .map((segment) => `'${segment}'`)
    .join(", ")
}

function windowEnd(start: Date, size: WindowSize): Date {
  const end = new Date(start)
  if (size === "hour") end.setUTCHours(end.getUTCHours() + 1)
  else if (size === "day") end.setUTCDate(end.getUTCDate() + 1)
  else end.setUTCMonth(end.getUTCMonth() + 1)
  return end
}

export function createClickHouseEventStore(
  config: ClickHouseStoreConfig,
  teamId: string,
): EventStore {
  const table = `${config.database}.om_events`

  async function request(
    query: string,
    params: Record<string, string | number>,
    body?: string,
  ): Promise<string> {
    const url = new URL(config.url)
    url.searchParams.set("query", query)
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(`param_${name}`, String(value))
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-ClickHouse-User": config.username,
        "X-ClickHouse-Key": config.password,
      },
      body: body ?? "",
      signal: AbortSignal.timeout(10_000),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`ClickHouse error: ${text.slice(0, 300)}`)
    }
    return text
  }

  return {
    async insert(events: InsertEventInput[]) {
      if (events.length === 0) return { accepted: 0 }
      const now = Math.floor(Date.now() / 1000)
      const rows = events
        .map((event) =>
          JSON.stringify({
            namespace: teamId,
            id: event.id,
            type: event.type,
            subject: event.subject,
            source: event.source,
            time: Math.floor(event.time.getTime() / 1000),
            data: event.data ? JSON.stringify(event.data) : "",
            ingested_at: now,
          }),
        )
        .join("\n")
      await request(`INSERT INTO ${table} FORMAT JSONEachRow`, {}, rows)
      return { accepted: events.length }
    },

    async aggregate(params: AggregateParams): Promise<AggregateRow[]> {
      const keys = pathKeys(params.valueProperty ?? "$.value")
      const agg = params.aggregation
      const valueExpr =
        agg === "count"
          ? "count()"
          : agg === "unique_count"
            ? `uniqExact(JSONExtractString(data, ${keys}))`
            : `${agg === "avg" ? "avg" : agg}(JSONExtractFloat(data, ${keys}))`

      const selects = [`${valueExpr} AS value`]
      const groups: string[] = []
      if (params.windowSize) {
        selects.push(
          `toUnixTimestamp(${BUCKET_FN[params.windowSize]}(time)) AS bucket_ts`,
        )
        groups.push("bucket_ts")
      }
      if (params.groupBy) {
        selects.push(
          `JSONExtractString(data, ${pathKeys(params.groupBy.path)}) AS grp`,
        )
        groups.push("grp")
      }
      const filters = [
        "namespace = {namespace:String}",
        "type = {type:String}",
        "time >= toDateTime({from:UInt32})",
        "time < toDateTime({to:UInt32})",
      ]
      const queryParams: Record<string, string | number> = {
        namespace: teamId,
        type: params.eventType,
        from: Math.floor(params.from.getTime() / 1000),
        to: Math.ceil(params.to.getTime() / 1000),
      }
      if (params.subject) {
        filters.push("subject = {subject:String}")
        queryParams.subject = params.subject
      }

      const query =
        `SELECT ${selects.join(", ")} FROM ${table} FINAL ` +
        `WHERE ${filters.join(" AND ")}` +
        (groups.length > 0 ? ` GROUP BY ${groups.join(", ")}` : "") +
        ` FORMAT JSON`

      const text = await request(query, queryParams)
      const parsed = JSON.parse(text) as {
        data: { value: number | string; bucket_ts?: string; grp?: string }[]
      }
      return parsed.data.map((row) => {
        const windowStart = row.bucket_ts
          ? new Date(Number(row.bucket_ts) * 1000)
          : params.from
        return {
          windowStart,
          windowEnd: params.windowSize
            ? windowEnd(windowStart, params.windowSize)
            : params.to,
          subject: params.subject ?? null,
          group: row.grp ?? null,
          value: Number(row.value) || 0,
        }
      })
    },

    async list(params: ListParams): Promise<StoredEvent[]> {
      const filters = ["namespace = {namespace:String}"]
      const queryParams: Record<string, string | number> = {
        namespace: teamId,
        limit: params.limit,
      }
      if (params.type) {
        filters.push("type = {type:String}")
        queryParams.type = params.type
      }
      if (params.subject) {
        filters.push("subject = {subject:String}")
        queryParams.subject = params.subject
      }
      if (params.cursor) {
        // Keyset: strictly older than (time desc, id desc). CH DateTime
        // has second precision, so compare on seconds; id breaks ties.
        filters.push(
          "(time < fromUnixTimestamp({cursorTs:UInt32}) OR " +
            "(time = fromUnixTimestamp({cursorTs:UInt32}) AND id < {cursorId:String}))"
        )
        queryParams.cursorTs = Math.floor(params.cursor.ts / 1000)
        queryParams.cursorId = params.cursor.id
      }
      const query =
        `SELECT id, type, subject, source, data, ` +
        `toUnixTimestamp(time) AS time_ts, ` +
        `toUnixTimestamp(ingested_at) AS ingested_ts ` +
        `FROM ${table} FINAL WHERE ${filters.join(" AND ")} ` +
        `ORDER BY time DESC, id DESC LIMIT {limit:UInt32} FORMAT JSON`

      const text = await request(query, queryParams)
      const parsed = JSON.parse(text) as {
        data: {
          id: string
          type: string
          subject: string
          source: string
          data: string
          time_ts: string
          ingested_ts: string
        }[]
      }
      return parsed.data.map((row) => ({
        storeRowId: `${row.source}:${row.id}`,
        teamId,
        id: row.id,
        type: row.type,
        subject: row.subject,
        source: row.source,
        time: new Date(Number(row.time_ts) * 1000),
        data: row.data ? JSON.parse(row.data) : null,
        ingestedAt: new Date(Number(row.ingested_ts) * 1000),
      }))
    },
  }
}
