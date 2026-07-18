import { createAuthClient } from "better-auth/react"
import {
  deviceAuthorizationClient,
  organizationClient,
  twoFactorClient,
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
    twoFactorClient({
      onTwoFactorRedirect() {
        // Sign-in succeeded but the account has 2FA — finish it there.
        window.location.href = "/two-factor"
      },
    }),
  ],
})
