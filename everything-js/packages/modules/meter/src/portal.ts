import { eq } from "drizzle-orm"

import type { ModuleDatabase } from "./context"
import { meterEntitlement, meterFeature } from "./schema"
import type { EventStore } from "./store"
import { computeEntitlementValue } from "./value"

// OpenMeter-style portal usage: everything a team's END-CUSTOMER may
// see about their own consumption — entitlement values for every
// feature they hold. Consumed by the /portal surface (portal-token
// auth, meter:read scope); the host constructs the store.
export async function portalUsage(
  db: ModuleDatabase,
  store: EventStore,
  teamId: string,
  subject: string,
) {
  const rows = await db
    .select({
      featureKey: meterFeature.key,
      featureName: meterFeature.name,
      subject: meterEntitlement.subject,
    })
    .from(meterEntitlement)
    .innerJoin(meterFeature, eq(meterEntitlement.featureId, meterFeature.id))
    .where(eq(meterEntitlement.teamId, teamId))

  const own = rows.filter((row) => row.subject === subject)
  const entitlements = []
  for (const row of own) {
    const value = await computeEntitlementValue({
      db,
      store,
      teamId,
      featureKey: row.featureKey,
      subject,
    })
    entitlements.push({
      featureKey: row.featureKey,
      featureName: row.featureName,
      ...value,
    })
  }
  return { entitlements }
}
