import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"

// RFC 9728 protected-resource metadata for the MCP gateway (apps/mcp,
// mounted at /mcp on this hostname). MCP clients hit /mcp, get a 401
// pointing here, and discover the authorization server (us).
export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: async () => {
        const origin = env.BETTER_AUTH_URL
        return Response.json({
          resource: `${origin}/mcp`,
          authorization_servers: [`${origin}/api/auth`],
          bearer_methods_supported: ["header"],
        })
      },
    },
  },
})
