import { createMiddleware } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { env } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/d1"
import { createAuth } from "@/lib/auth"
import * as schema from "@/lib/db/schema"

export function getDb(env: Env) {
  return drizzle(env.DB, { schema })
}

// Loads the current session (possibly null) into context. A route's
// beforeLoad redirect only protects the page's UI, not a server function's
// own RPC endpoint — every server function needs its own auth story, and
// this is the shared building block for it.
export const sessionMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const headers = new Headers(getRequestHeaders() as HeadersInit)
    const auth = createAuth(env)
    const session = await auth.api.getSession({ headers })
    // For server functions that need a direct table query (e.g. checking
    // ownership across all orgs) rather than going through a better-auth
    // API call.
    const db = getDb(env)
    return next({ context: { auth, headers, session, db } })
  },
)

// Requires an authenticated session — for server functions that only ever
// make sense for a signed-in user (as opposed to ones like getServerSession
// that need to handle "no session" as a valid, expected state).
export const authMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    if (!context.session) {
      throw new Error("Unauthorized")
    }
    return next({ context: { session: context.session } })
  })
