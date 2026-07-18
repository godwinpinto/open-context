import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider"
import { createAuth } from "@/lib/auth"

export const Route = createFileRoute("/.well-known/openid-configuration")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return oauthProviderOpenIdConfigMetadata(createAuth(env))(request)
      },
    },
  },
})
