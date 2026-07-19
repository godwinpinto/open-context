import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleMeterConsumer } from "@/lib/modules/meter"

export const Route = createFileRoute("/api/meter/v1/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleMeterConsumer(request, env),
      POST: ({ request }: { request: Request }) =>
        handleMeterConsumer(request, env),
    },
  },
})
