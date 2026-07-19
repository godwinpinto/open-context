import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { identityAdminRouter } from "@open-context/core"

// Typed client for the identity admin surface — same-origin, session
// cookie. Client-rendered pages only.
const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/identity/admin` })

export const identityClient: RouterClient<typeof identityAdminRouter> =
  createORPCClient(link)
