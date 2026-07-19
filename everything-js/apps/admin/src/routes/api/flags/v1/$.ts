import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleFlagsConsumer } from "@/lib/modules/flags"

export const Route = createFileRoute("/api/flags/v1/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleFlagsConsumer(request, env),
      POST: ({ request }: { request: Request }) =>
        handleFlagsConsumer(request, env),
    },
  },
})
