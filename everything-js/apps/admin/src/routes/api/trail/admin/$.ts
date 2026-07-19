import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleTrailAdmin } from "@/lib/modules/trail"

export const Route = createFileRoute("/api/trail/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleTrailAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleTrailAdmin(request, env),
    },
  },
})
