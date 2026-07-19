// Property operations (PostHog/Mixpanel-style):
//   set        — overwrite keys
//   setOnce    — write only keys not already present
//   unset      — delete keys
//   increment  — numeric delta (negative = decrement); a non-numeric
//                existing value is replaced by the delta
// Applied read-modify-write: D1 serializes writes per database, and
// identity properties are state (not usage), so last-write-wins is the
// intended semantics — usage counting belongs to Meter.

export type PropertyOps = {
  set?: Record<string, unknown>
  setOnce?: Record<string, unknown>
  unset?: string[]
  increment?: Record<string, number>
}

export function applyOps(
  current: Record<string, unknown>,
  ops: PropertyOps,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }
  if (ops.set) {
    Object.assign(next, ops.set)
  }
  if (ops.setOnce) {
    for (const [key, value] of Object.entries(ops.setOnce)) {
      if (!(key in next)) next[key] = value
    }
  }
  if (ops.increment) {
    for (const [key, delta] of Object.entries(ops.increment)) {
      const existing = next[key]
      next[key] = (typeof existing === "number" ? existing : 0) + delta
    }
  }
  if (ops.unset) {
    for (const key of ops.unset) {
      delete next[key]
    }
  }
  return next
}
