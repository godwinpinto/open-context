import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { flagsAdminRouter } from "@open-context/module-flags"

const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/flags/admin` })

export const flagsClient: RouterClient<typeof flagsAdminRouter> =
  createORPCClient(link)
