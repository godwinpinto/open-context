import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handleDashboardShare } from "@/lib/modules/dashboards"

export const Route = createFileRoute("/api/share/d/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleDashboardShare(request, env),
    },
  },
})
