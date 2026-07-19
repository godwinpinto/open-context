import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleWebhooksAdmin } from "@/lib/modules/webhooks"

export const Route = createFileRoute("/api/webhooks/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleWebhooksAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleWebhooksAdmin(request, env),
    },
  },
})
