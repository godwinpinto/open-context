import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"

// Same-origin — the admin worker owns /api/auth/* on this hostname and
// the session cookie is shared across every module on it.
export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      teams: {
        enabled: true,
      },
    }),
  ],
})
