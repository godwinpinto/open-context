import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleFlagsAdmin } from "@/lib/modules/flags"

export const Route = createFileRoute("/api/flags/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleFlagsAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleFlagsAdmin(request, env),
    },
  },
})
