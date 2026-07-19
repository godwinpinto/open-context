import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"
import { handlePortal } from "@/lib/modules/portal"

export const Route = createFileRoute("/api/portal/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handlePortal(request, env),
      POST: ({ request }: { request: Request }) => handlePortal(request, env),
      DELETE: ({ request }: { request: Request }) => handlePortal(request, env),
    },
  },
})
