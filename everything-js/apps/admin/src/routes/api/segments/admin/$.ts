import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleSegmentsAdmin } from "@/lib/modules/identity"

export const Route = createFileRoute("/api/segments/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleSegmentsAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleSegmentsAdmin(request, env),
    },
  },
})
