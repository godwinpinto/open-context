import { and, eq, inArray } from "drizzle-orm"

import type { CoreDatabase } from "../identity/context"
import { identityId as deriveIdentityId, uuidv5 } from "../identity/ids"
import { coreIdentity } from "../identity/schema"
import { getMergedProperties } from "../identity/store"
import { evaluateRules } from "./rules"
import { coreSegment, coreSegmentIdentity } from "./schema"

export const SEGMENT_NAMESPACE = "b1d47e92-6a3f-4c58-9e07-4d8b2a5f1c63"

export function segmentId(teamId: string, key: string) {
  return uuidv5(SEGMENT_NAMESPACE, `${teamId}:${key}`)
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Manual members can be entered as an identity key OR its uuid — the
// deterministic IDs make them interchangeable.
export async function resolveIdentityId(
  teamId: string,
  keyOrId: string,
): Promise<string> {
  if (UUID_PATTERN.test(keyOrId)) return keyOrId.toLowerCase()
  return deriveIdentityId(teamId, keyOrId)
}

// The module-facing filter primitive: which segments is this identity
// in? One merged-props fetch + one membership query, dynamic rules
// evaluated in memory.
export async function identityInSegments(
  db: CoreDatabase,
  teamId: string,
  identityKey: string,
): Promise<string[]> {
  const segments = await db
    .select()
    .from(coreSegment)
    .where(eq(coreSegment.teamId, teamId))
  if (segments.length === 0) return []

  const matched: string[] = []

  const dynamic = segments.filter((s) => s.type === "dynamic" && s.rules)
  if (dynamic.length > 0) {
    const merged = await getMergedProperties(db, teamId, identityKey)
    for (const segment of dynamic) {
      if (
        evaluateRules(segment.rules!, merged.properties, identityKey, segment.id)
      ) {
        matched.push(segment.key)
      }
    }
  }

  const manual = segments.filter((s) => s.type === "manual")
  if (manual.length > 0) {
    const idOfIdentity = await deriveIdentityId(teamId, identityKey)
    const memberships = await db
      .select({ segmentId: coreSegmentIdentity.segmentId })
      .from(coreSegmentIdentity)
      .where(
        and(
          eq(coreSegmentIdentity.teamId, teamId),
          eq(coreSegmentIdentity.identityId, idOfIdentity),
          inArray(
            coreSegmentIdentity.segmentId,
            manual.map((s) => s.id),
          ),
        ),
      )
    const memberOf = new Set(memberships.map((m) => m.segmentId))
    for (const segment of manual) {
      if (memberOf.has(segment.id)) matched.push(segment.key)
    }
  }

  return matched
}

// Admin preview for dynamic segments: scan + evaluate (O(identities),
// fine to tens of thousands; materialized membership is a future
// ClickHouse-era optimization).
export async function previewDynamicMembers(
  db: CoreDatabase,
  teamId: string,
  segment: { id: string; rules: NonNullable<typeof coreSegment.$inferSelect.rules> },
  limit: number,
): Promise<{ key: string; properties: Record<string, unknown> }[]> {
  const identities = await db
    .select()
    .from(coreIdentity)
    .where(eq(coreIdentity.teamId, teamId))
    .limit(2000)

  const members: { key: string; properties: Record<string, unknown> }[] = []
  for (const identity of identities) {
    // Merged props per identity; group-derived traits count.
    const merged = await getMergedProperties(db, teamId, identity.key)
    if (evaluateRules(segment.rules, merged.properties, identity.key, segment.id)) {
      members.push({ key: identity.key, properties: merged.properties })
      if (members.length >= limit) break
    }
  }
  return members
}
