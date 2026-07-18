import { createServerFn } from "@tanstack/react-start"
import { sessionMiddleware } from "@/lib/auth/middleware"

export const getServerSession = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context }) => context.session)
