import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleExperimentsAdmin } from "@/lib/modules/experiments"

export const Route = createFileRoute("/api/experiments/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleExperimentsAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleExperimentsAdmin(request, env),
    },
  },
})
