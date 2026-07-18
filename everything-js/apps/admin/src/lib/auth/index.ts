import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import { jwt, organization } from "better-auth/plugins"
import { oauthProvider } from "@better-auth/oauth-provider"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import * as schema from "../db/schema"

// Plugins are declared inline (rather than shared via a helper function)
// so TypeScript infers `plugins` as a tuple, not a widened union array —
// that tuple shape is what lets better-auth augment the Session/User types
// with each plugin's added fields (e.g. session.activeOrganizationId).
export function createAuth(env: Env) {
  return betterAuth({
    appName: "Open Context Admin",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
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
      }),
      tanstackStartCookies(), // must be last
    ],
  })
}
