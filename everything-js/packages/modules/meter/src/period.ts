export type UsagePeriod = "day" | "week" | "month"

// Calendar-aligned (UTC) start of the current usage period.
export function currentPeriodStart(period: UsagePeriod, now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  if (period === "week") {
    // ISO week: Monday start.
    const day = start.getUTCDay()
    start.setUTCDate(start.getUTCDate() - ((day + 6) % 7))
  } else if (period === "month") {
    start.setUTCDate(1)
  }
  return start
}
