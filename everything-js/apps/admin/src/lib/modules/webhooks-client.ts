import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { webhooksAdminRouter } from "@open-context/module-webhooks"

const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/webhooks/admin` })

export const webhooksClient: RouterClient<typeof webhooksAdminRouter> =
  createORPCClient(link)
