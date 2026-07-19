import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleExperimentsConsumer } from "@/lib/modules/experiments"

export const Route = createFileRoute("/api/experiments/v1/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleExperimentsConsumer(request, env),
      POST: ({ request }: { request: Request }) =>
        handleExperimentsConsumer(request, env),
    },
  },
})
