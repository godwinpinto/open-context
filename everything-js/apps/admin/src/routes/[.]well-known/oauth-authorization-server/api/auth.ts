import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"
import { createAuth } from "@/lib/auth"

// RFC 8414 §3.1: when the issuer has a path component (our issuer is
// `{baseURL}/api/auth`), the well-known path inserts that path *after*
// the well-known segment rather than appending it.
export const Route = createFileRoute(
  "/.well-known/oauth-authorization-server/api/auth",
)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return oauthProviderAuthServerMetadata(createAuth(env))(request)
      },
    },
  },
})
