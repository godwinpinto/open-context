import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { oauthProviderClient } from "@better-auth/oauth-provider/client"

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      teams: {
        enabled: true,
      },
      dynamicAccessControl: {
        enabled: true,
      },
    }),
    oauthProviderClient(),
  ],
})
