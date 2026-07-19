import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleWebhooksConsumer } from "@/lib/modules/webhooks"

export const Route = createFileRoute("/api/webhooks/v1/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleWebhooksConsumer(request, env),
      POST: ({ request }: { request: Request }) =>
        handleWebhooksConsumer(request, env),
      DELETE: ({ request }: { request: Request }) =>
        handleWebhooksConsumer(request, env),
    },
  },
})
