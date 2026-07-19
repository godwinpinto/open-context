import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleTrailConsumer } from "@/lib/modules/trail"

export const Route = createFileRoute("/api/trail/v1/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleTrailConsumer(request, env),
      POST: ({ request }: { request: Request }) =>
        handleTrailConsumer(request, env),
    },
  },
})
