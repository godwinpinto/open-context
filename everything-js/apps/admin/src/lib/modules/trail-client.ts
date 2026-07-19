import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { trailAdminRouter } from "@open-context/module-trail"

// Typed client for the Trail module's admin surface — same-origin, the
// session cookie authenticates it. Only used from client-rendered
// (ssr: false) module routes; the window guard keeps the import safe if
// an SSR chunk ever pulls it in.
const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/trail/admin` })

export const trailClient: RouterClient<typeof trailAdminRouter> =
  createORPCClient(link)
