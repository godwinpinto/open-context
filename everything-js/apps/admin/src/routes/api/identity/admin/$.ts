import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleIdentityAdmin } from "@/lib/modules/identity"

export const Route = createFileRoute("/api/identity/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleIdentityAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleIdentityAdmin(request, env),
    },
  },
})
