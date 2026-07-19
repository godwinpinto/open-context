import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleMeterAdmin } from "@/lib/modules/meter"

export const Route = createFileRoute("/api/meter/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleMeterAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleMeterAdmin(request, env),
    },
  },
})
