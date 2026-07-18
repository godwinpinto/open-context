import { createAuthClient } from "better-auth/client"
import { deviceAuthorizationClient } from "better-auth/client/plugins"

// Must match the client_id the server accepts in validateClient
// (apps/admin/src/lib/auth/index.ts, CLI_CLIENT_ID). There's only one
// CLI client, so it's a fixed public identifier rather than a row in
// oauth_client.
export const CLI_CLIENT_ID = "open-context-cli"

const DEFAULT_BASE_URL = "https://openctx.encatch.dev"

export function resolveBaseURL(override?: string) {
  return override ?? process.env.OPEN_CONTEXT_API_URL ?? DEFAULT_BASE_URL
}

export function createClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [deviceAuthorizationClient()],
  })
}
