// Portal tokens — the 4th auth surface (session / API key / OAuth /
// portal token). A team's backend mints a short-lived token for THEIR
// logged-in customer (an identity), granting scoped access to the
// hosted /portal surface (usage view, webhook endpoint self-service).
//
// STATELESS by design: HMAC-signed claims, no storage, no DB lookup
// per portal request. Signed with the platform auth secret (passed in
// by the host — core takes no env). Trade-off, accepted: no per-token
// revocation (only secret rotation), mitigated by short expiries.

export type PortalScope = "meter:read" | "webhooks:manage"

export type PortalClaims = {
  teamId: string
  identity: string
  scopes: PortalScope[]
  exp: number // unix seconds
}

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)))
}

export async function createPortalToken(
  secret: string,
  claims: Omit<PortalClaims, "exp"> & { expiresInSeconds: number },
): Promise<string> {
  const payload: PortalClaims = {
    teamId: claims.teamId,
    identity: claims.identity,
    scopes: claims.scopes,
    exp: Math.floor(Date.now() / 1000) + claims.expiresInSeconds,
  }
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  const signature = base64url(await hmac(secret, body))
  return `oc_pt_${body}.${signature}`
}

export async function verifyPortalToken(
  secret: string,
  token: string,
): Promise<PortalClaims | null> {
  if (!token.startsWith("oc_pt_")) return null
  const [body, signature] = token.slice(6).split(".")
  if (!body || !signature) return null

  const expected = base64url(await hmac(secret, body))
  // Constant-time-ish compare.
  if (expected.length !== signature.length) return null
  let mismatch = 0
  for (let index = 0; index < expected.length; index++) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index)
  }
  if (mismatch !== 0) return null

  try {
    const claims = JSON.parse(
      new TextDecoder().decode(base64urlDecode(body)),
    ) as PortalClaims
    if (typeof claims.exp !== "number" || claims.exp < Date.now() / 1000) {
      return null
    }
    if (!claims.teamId || !claims.identity || !Array.isArray(claims.scopes)) {
      return null
    }
    return claims
  } catch {
    return null
  }
}
