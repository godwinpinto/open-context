import { createAuthClient } from "better-auth/react"
import {
  deviceAuthorizationClient,
  organizationClient,
} from "better-auth/client/plugins"
import { apiKeyClient } from "@better-auth/api-key/client"
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
    deviceAuthorizationClient(),
    apiKeyClient(),
  ],
})
