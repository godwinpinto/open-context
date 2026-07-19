import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// The MCP host owns its own auth glue (hosts never share app code).
// Tokens come from admin's OAuth 2.1 provider; validation is a
// userinfo call against ADMIN_URL — URL-based rather than a service
// binding so the same code runs on Node later.

// Minimal views of admin-owned auth tables (read-only here).
export const team = sqliteTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organization_id").notNull(),
})

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
})

export type Env = {
  DB: D1Database
  ADMIN_URL: string
}

export function getDb(env: Env) {
  return drizzle(env.DB)
}

export type AuthedUser = { userId: string }

export async function validateToken(
  env: Env,
  authorization: string | undefined,
): Promise<AuthedUser | null> {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null
  const response = await fetch(`${env.ADMIN_URL}/api/auth/oauth2/userinfo`, {
    headers: { Authorization: authorization },
  })
  if (!response.ok) return null
  const claims = (await response.json()) as { sub?: string }
  if (!claims.sub) return null
  return { userId: claims.sub }
}

export async function listUserTeams(db: ReturnType<typeof getDb>, userId: string) {
  return db
    .select({ teamId: team.id, teamName: team.name, role: member.role })
    .from(member)
    .innerJoin(team, eq(member.organizationId, team.organizationId))
    .where(eq(member.userId, userId))
}

export function makeAssertTeamAccess(
  db: ReturnType<typeof getDb>,
  userId: string,
) {
  return async (teamId: string) => {
    const [row] = await db
      .select({ id: member.id })
      .from(team)
      .innerJoin(
        member,
        and(
          eq(member.organizationId, team.organizationId),
          eq(member.userId, userId),
        ),
      )
      .where(eq(team.id, teamId))
    if (!row) throw new Error("Not a member of this team")
  }
}
