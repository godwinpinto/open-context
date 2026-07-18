import { createServerFn } from "@tanstack/react-start"
import { authMiddleware } from "@/lib/auth/middleware"

export const updateUserName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data, context }) => {
    return context.auth.api.updateUser({
      body: { name: data.name },
      headers: context.headers,
    })
  })

export const getUserSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return context.auth.api.listSessions({ headers: context.headers })
  })

export const revokeUserSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data, context }) => {
    return context.auth.api.revokeSession({
      body: { token: data.token },
      headers: context.headers,
    })
  })

export const revokeOtherUserSessions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return context.auth.api.revokeOtherSessions({
      headers: context.headers,
    })
  })

type PublicClient = {
  name?: string
  client_name?: string
}

// oauthConsent rows are just { id, clientId, scopes, createdAt, ... } — no
// client display name, so each is enriched with a lookup against the
// public client-info endpoint (the same one the consent screen itself uses).
export const getUserOAuthConsents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { auth, headers } = context
    const consents = await auth.api.getOAuthConsents({ headers })

    const clientIds = [...new Set(consents.map((c) => c.clientId))]
    const clients = await Promise.all(
      clientIds.map(async (clientId) => {
        const client = (await auth.api
          .getOAuthClientPublic({ query: { client_id: clientId }, headers })
          .catch(() => null)) as PublicClient | null
        return [clientId, client] as const
      }),
    )
    const clientsById = new Map(clients)

    return consents.map((consent) => {
      const client = clientsById.get(consent.clientId)
      return {
        ...consent,
        clientName: client?.name ?? client?.client_name ?? consent.clientId,
      }
    })
  })

export const revokeUserOAuthConsent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    return context.auth.api.deleteOAuthConsent({
      body: { id: data.id },
      headers: context.headers,
    })
  })
