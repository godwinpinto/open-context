import { Hono } from "hono"
import { StreamableHTTPTransport } from "@hono/mcp"

import { validateToken, type Env } from "./auth"
import { buildServer } from "./tools"

// Open Context MCP gateway — a separate worker (own bundle budget,
// own deploy cadence, streaming isolation) sharing the platform's D1
// and packages: the modular monolith running in a second host.
// Portable by construction: Hono + fetch-based transport + URL-based
// token validation — swap the adapter and this runs on Node.

const app = new Hono<{ Bindings: Env }>()

app.all("/mcp", async (c) => {
  const user = await validateToken(c.env, c.req.header("authorization"))
  if (!user) {
    // MCP auth discovery: point clients at the protected-resource
    // metadata (served by admin on this same origin).
    return c.json(
      { error: "unauthorized" },
      401,
      {
        "WWW-Authenticate": `Bearer resource_metadata="${new URL(c.req.url).origin}/.well-known/oauth-protected-resource"`,
      },
    )
  }

  // Stateless per-request server: tool closures carry this request's
  // authenticated user.
  const server = buildServer(c.env, user)
  const transport = new StreamableHTTPTransport()
  await server.connect(transport)
  return transport.handleRequest(c)
})

app.get("/mcp/health", (c) => c.json({ ok: true, service: "open-context-mcp" }))

export default app
