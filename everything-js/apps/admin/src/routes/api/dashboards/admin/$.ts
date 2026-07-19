import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleDashboardsAdmin } from "@/lib/modules/dashboards"

export const Route = createFileRoute("/api/dashboards/admin/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleDashboardsAdmin(request, env),
      POST: ({ request }: { request: Request }) =>
        handleDashboardsAdmin(request, env),
    },
  },
})
