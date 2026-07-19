import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { experimentsAdminRouter } from "@open-context/module-experiments"

const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/experiments/admin` })

export const experimentsClient: RouterClient<typeof experimentsAdminRouter> =
  createORPCClient(link)
