// Dynamic segment rules — evaluated against an identity's MERGED
// properties (group props under identity props, identity wins).
// Pure functions: the flags/entitlements hot path runs these in
// memory after a single merged-properties fetch.

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "is_set"
  | "is_not_set"
  | "regex"

export type SegmentCondition =
  | {
      type: "property"
      property: string
      operator: SegmentOperator
      value?: unknown
    }
  | {
      type: "split"
      percentage: number
    }

export type SegmentRules = {
  match: "all" | "any"
  conditions: SegmentCondition[]
}

// ── FROZEN CONTRACT ──────────────────────────────────────────────
// FNV-1a 32-bit over `${segmentId}:${identityKey}` mod 100. Split
// assignment must be stable forever: changing this algorithm would
// silently reshuffle every percentage rollout in production. Never
// touch it; a new algorithm means a new condition type.
export function splitBucket(segmentId: string, identityKey: string): number {
  const input = `${segmentId}:${identityKey}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % 100
}

// Weighted variant assignment (experiments now, multivariate flags
// later). Same FNV-1a, finer 10000-bucket granularity, thresholds from
// cumulative weights. Equally FROZEN: changing this reassigns every
// running experiment's variants mid-flight.
export function variantFor(
  scopeId: string,
  identityKey: string,
  variants: { key: string; weight: number }[],
): string {
  const input = `${scopeId}:${identityKey}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const bucket = hash % 10000

  const total = variants.reduce((sum, variant) => sum + variant.weight, 0)
  let cumulative = 0
  for (const variant of variants) {
    cumulative += variant.weight
    if (bucket < Math.floor((cumulative / total) * 10000)) {
      return variant.key
    }
  }
  return variants[variants.length - 1].key
}
// ─────────────────────────────────────────────────────────────────

const REGEX_MAX_LENGTH = 200

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

export function evaluateCondition(
  condition: SegmentCondition,
  properties: Record<string, unknown>,
  identityKey: string,
  segmentId: string,
): boolean {
  if (condition.type === "split") {
    return splitBucket(segmentId, identityKey) < condition.percentage
  }

  const actual = properties[condition.property]
  switch (condition.operator) {
    case "is_set":
      return actual !== undefined && actual !== null
    case "is_not_set":
      return actual === undefined || actual === null
    case "equals":
      return actual === condition.value || String(actual) === String(condition.value)
    case "not_equals":
      return !(actual === condition.value || String(actual) === String(condition.value))
    case "contains":
      return typeof actual === "string" && actual.includes(String(condition.value))
    case "not_contains":
      return !(typeof actual === "string" && actual.includes(String(condition.value)))
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = asNumber(actual)
      const right = asNumber(condition.value)
      if (left === null || right === null) return false
      if (condition.operator === "gt") return left > right
      if (condition.operator === "gte") return left >= right
      if (condition.operator === "lt") return left < right
      return left <= right
    }
    case "in":
      return Array.isArray(condition.value)
        ? condition.value.some((v) => v === actual || String(v) === String(actual))
        : false
    case "regex": {
      const pattern = String(condition.value ?? "")
      if (pattern.length === 0 || pattern.length > REGEX_MAX_LENGTH) return false
      try {
        return new RegExp(pattern).test(String(actual ?? ""))
      } catch {
        return false
      }
    }
  }
}

export function evaluateRules(
  rules: SegmentRules,
  properties: Record<string, unknown>,
  identityKey: string,
  segmentId: string,
): boolean {
  if (rules.conditions.length === 0) return false
  const results = rules.conditions.map((condition) =>
    evaluateCondition(condition, properties, identityKey, segmentId),
  )
  return rules.match === "all" ? results.every(Boolean) : results.some(Boolean)
}

// Per-condition breakdown for the admin "test identity" debugger.
export function explainRules(
  rules: SegmentRules,
  properties: Record<string, unknown>,
  identityKey: string,
  segmentId: string,
): { matched: boolean; conditions: { condition: SegmentCondition; passed: boolean }[] } {
  const conditions = rules.conditions.map((condition) => ({
    condition,
    passed: evaluateCondition(condition, properties, identityKey, segmentId),
  }))
  const matched =
    conditions.length === 0
      ? false
      : rules.match === "all"
        ? conditions.every((entry) => entry.passed)
        : conditions.some((entry) => entry.passed)
  return { matched, conditions }
}
