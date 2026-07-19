import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { meterAdminRouter } from "@open-context/module-meter"

// Typed client for the Meter module's admin surface — same-origin, the
// session cookie authenticates it. Only used from client-rendered
// module routes.
const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/meter/admin` })

export const meterClient: RouterClient<typeof meterAdminRouter> =
  createORPCClient(link)
