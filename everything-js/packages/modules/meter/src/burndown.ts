// Slice-based burn-down: pools (periodic allowance + grants) have
// lifetimes; usage is aggregated per timeline slice between pool
// boundaries and allocated to the pools active in that slice, in
// priority → nearest-expiry → oldest order. Usage no pool covers is
// overage. Expired/voided credit stops being burnable AND stops being
// balance — exactly OpenMeter's semantics, computed from events on
// every read (no stored counters).

export type BurnPool = {
  id: string
  kind: "allowance" | "grant"
  amount: number
  priority: number
  // Active window [start, end); end null = active until "now".
  start: Date
  end: Date | null
  createdAt: Date
}

export type UsageAggregator = (from: Date, to: Date) => Promise<number>

export type BurnDownResult = {
  usage: number
  overage: number
  balance: number
  pools: { id: string; kind: "allowance" | "grant"; remaining: number }[]
}

function poolBurnOrder(now: Date) {
  return (a: BurnPool, b: BurnPool) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    const aEnd = a.end?.getTime() ?? Infinity
    const bEnd = b.end?.getTime() ?? Infinity
    if (aEnd !== bEnd) return aEnd - bEnd
    return a.createdAt.getTime() - b.createdAt.getTime() || +now * 0
  }
}

export async function computeBurnDown(
  pools: BurnPool[],
  now: Date,
  aggregate: UsageAggregator,
): Promise<BurnDownResult> {
  if (pools.length === 0) {
    return { usage: 0, overage: 0, balance: 0, pools: [] }
  }

  // Timeline boundaries: every pool start/end inside (anchor, now).
  const anchor = new Date(Math.min(...pools.map((pool) => pool.start.getTime())))
  const boundaries = new Set<number>([anchor.getTime(), now.getTime()])
  for (const pool of pools) {
    if (pool.start > anchor && pool.start < now) {
      boundaries.add(pool.start.getTime())
    }
    if (pool.end && pool.end > anchor && pool.end < now) {
      boundaries.add(pool.end.getTime())
    }
  }
  const points = [...boundaries].sort((a, b) => a - b)

  const remaining = new Map(pools.map((pool) => [pool.id, pool.amount]))
  let totalUsage = 0
  let overage = 0
  const order = poolBurnOrder(now)

  for (let index = 0; index < points.length - 1; index++) {
    const sliceStart = new Date(points[index])
    const sliceEnd = new Date(points[index + 1])
    let usage = await aggregate(sliceStart, sliceEnd)
    if (usage < 0) usage = 0 // net refunds in a slice can't mint credit
    totalUsage += usage
    if (usage === 0) continue

    const active = pools
      .filter(
        (pool) =>
          pool.start <= sliceStart && (pool.end === null || pool.end > sliceStart),
      )
      .sort(order)
    for (const pool of active) {
      if (usage <= 0) break
      const left = remaining.get(pool.id) ?? 0
      const burn = Math.min(left, usage)
      remaining.set(pool.id, left - burn)
      usage -= burn
    }
    overage += usage
  }

  // Balance = remaining credit in pools still active at "now".
  const activeNow = pools.filter(
    (pool) => pool.start <= now && (pool.end === null || pool.end > now),
  )
  const balance = activeNow.reduce(
    (sum, pool) => sum + (remaining.get(pool.id) ?? 0),
    0,
  )

  return {
    usage: totalUsage,
    overage,
    balance,
    pools: activeNow
      .sort(order)
      .map((pool) => ({
        id: pool.id,
        kind: pool.kind,
        remaining: remaining.get(pool.id) ?? 0,
      })),
  }
}
