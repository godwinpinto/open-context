import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer, deviceAuthorization, jwt, organization } from "better-auth/plugins"
import { apiKey } from "@better-auth/api-key"
import { oauthProvider } from "@better-auth/oauth-provider"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import * as schema from "../db/schema"
import { accessControl } from "./access-control"
import { getDb } from "./middleware"
import { isOrgOwnerAnywhere } from "./org-limits"

// Must match the client_id the CLI sends (packages/cli/src/auth.ts).
// There's only one CLI client, so it's a fixed public identifier rather
// than a row in oauth_client.
export const CLI_CLIENT_ID = "open-context-cli"

// Plugins are declared inline (rather than shared via a helper function)
// so TypeScript infers `plugins` as a tuple, not a widened union array —
// that tuple shape is what lets better-auth augment the Session/User types
// with each plugin's added fields (e.g. session.activeOrganizationId).
export function createAuth(env: Env) {
  const db = getDb(env)

  return betterAuth({
    appName: "Open Context Admin",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    // The jwt() plugin also exposes a session -> JWT exchange at /token.
    // We only use it internally to sign OAuth access/id tokens, so it's
    // disabled to avoid an extra unused auth surface.
    disabledPaths: ["/token"],
    plugins: [
      jwt(),
      oauthProvider({
        loginPage: "/",
        consentPage: "/consent",
        // MCP clients register themselves at connection time and are
        // typically unauthenticated when they do so.
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // RFC 8414 §3.1 well-known path (with the /api/auth issuer path
        // inserted) is served by the [.]well-known route.
        silenceWarnings: { oauthAuthServerConfig: true },
      }),
      organization({
        teams: {
          enabled: true,
        },
        ac: accessControl,
        dynamicAccessControl: {
          enabled: true,
        },
        // Cap organization ownership at one per user — being invited as
        // admin/member elsewhere is unrestricted, but you can only *own*
        // a single org at a time.
        allowUserToCreateOrganization: async (user) => {
          const alreadyOwnsOrg = await isOrgOwnerAnywhere(db, user.id)
          return !alreadyOwnsOrg
        },
      }),
      // Static keys for non-interactive callers (CI, scripts, other
      // tools). Keys are user-owned; verification happens server-side
      // via auth.api.verifyApiKey — a key is NOT a session
      // (enableSessionForAPIKeys stays off per better-auth's guidance).
      apiKey({
        defaultPrefix: "oc_",
        requireName: true,
      }),
      // Lets the CLI (packages/cli) sign in via RFC 8628 device code flow,
      // then use the resulting session token as `Authorization: Bearer`.
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
      bearer(),
      tanstackStartCookies(), // must be last
    ],
  })
}
