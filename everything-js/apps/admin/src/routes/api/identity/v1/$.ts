import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleIdentityConsumer } from "@/lib/modules/identity"

export const Route = createFileRoute("/api/identity/v1/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleIdentityConsumer(request, env),
      POST: ({ request }: { request: Request }) =>
        handleIdentityConsumer(request, env),
    },
  },
})
