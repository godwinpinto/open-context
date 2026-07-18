import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"
import { createAuth } from "@/lib/auth"

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return oauthProviderAuthServerMetadata(createAuth(env))(request)
      },
    },
  },
})
