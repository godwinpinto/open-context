import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { segmentsAdminRouter } from "@open-context/core"

const origin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin
const link = new RPCLink({ url: `${origin}/api/segments/admin` })

export const segmentsClient: RouterClient<typeof segmentsAdminRouter> =
  createORPCClient(link)
