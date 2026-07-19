import { and, asc, eq } from "drizzle-orm"
import { identityId, identityInSegments } from "@open-context/core"

import type { ModuleDatabase } from "./context"
import {
  flag,
  flagEnvironment,
  flagIdentityOverride,
  flagSegmentOverride,
  flagState,
} from "./schema"

export type FlagResult = {
  enabled: boolean
  value: unknown
  // Why: which layer of the precedence chain decided.
  source: "identity-override" | `segment:${string}` | "default"
}

// The evaluation engine — one pass for ALL of a team's flags in an
// environment. Precedence per flag:
//   identity override → segment overrides (priority asc) → env default
// (missing state row = disabled). Request-passed traits merge over the
// identity's stored merged properties for segment matching.
export async function evaluateFlags(
  db: ModuleDatabase,
  teamId: string,
  environmentKey: string,
  identityKey: string,
  traits?: Record<string, unknown>,
): Promise<Record<string, FlagResult>> {
  const [environment] = await db
    .select()
    .from(flagEnvironment)
    .where(
      and(
        eq(flagEnvironment.teamId, teamId),
        eq(flagEnvironment.key, environmentKey),
      ),
    )
  if (!environment) return {}

  const flags = await db.select().from(flag).where(eq(flag.teamId, teamId))
  if (flags.length === 0) return {}

  const [states, segmentOverrides, identityOverrides] = await Promise.all([
    db
      .select()
      .from(flagState)
      .where(eq(flagState.environmentId, environment.id)),
    db
      .select()
      .from(flagSegmentOverride)
      .where(eq(flagSegmentOverride.environmentId, environment.id))
      .orderBy(asc(flagSegmentOverride.priority), asc(flagSegmentOverride.createdAt)),
    (async () => {
      const id = await identityId(teamId, identityKey)
      return db
        .select()
        .from(flagIdentityOverride)
        .where(
          and(
            eq(flagIdentityOverride.environmentId, environment.id),
            eq(flagIdentityOverride.identityId, id),
          ),
        )
    })(),
  ])

  // Segment membership computed once, only if any segment overrides
  // exist for this environment.
  const memberOf =
    segmentOverrides.length > 0
      ? new Set(await identityInSegments(db, teamId, identityKey, traits))
      : new Set<string>()

  const stateByFlag = new Map(states.map((state) => [state.flagId, state]))
  const identityByFlag = new Map(
    identityOverrides.map((override) => [override.flagId, override]),
  )
  const segmentsByFlag = new Map<string, typeof segmentOverrides>()
  for (const override of segmentOverrides) {
    const list = segmentsByFlag.get(override.flagId) ?? []
    list.push(override)
    segmentsByFlag.set(override.flagId, list)
  }

  const results: Record<string, FlagResult> = {}
  for (const definition of flags) {
    const identityOverride = identityByFlag.get(definition.id)
    if (identityOverride) {
      results[definition.key] = {
        enabled: identityOverride.enabled,
        value: identityOverride.value ?? null,
        source: "identity-override",
      }
      continue
    }

    const matching = (segmentsByFlag.get(definition.id) ?? []).find(
      (override) => memberOf.has(override.segmentKey),
    )
    if (matching) {
      results[definition.key] = {
        enabled: matching.enabled,
        value: matching.value ?? null,
        source: `segment:${matching.segmentKey}`,
      }
      continue
    }

    const state = stateByFlag.get(definition.id)
    results[definition.key] = {
      enabled: state?.enabled ?? false,
      value: state?.value ?? null,
      source: "default",
    }
  }
  return results
}
