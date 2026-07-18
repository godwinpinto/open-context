import { and, eq } from "drizzle-orm"
import type { getDb } from "@/lib/auth/middleware"
import { member } from "@/lib/db/schema"

// A single org owner cap, enforced both server-side (see
// allowUserToCreateOrganization in lib/auth/index.ts, which is the actual
// guarantee) and via getCanCreateOrganization for the UI to check before
// showing a dead-end "New organization" action.
export async function isOrgOwnerAnywhere(
  db: ReturnType<typeof getDb>,
  userId: string,
) {
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")))
    .limit(1)
  return rows.length > 0
}
