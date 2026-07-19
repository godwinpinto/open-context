// Deterministic UUIDv5 (RFC 4122, SHA-1 based) identity IDs.
// id = uuidv5(namespace, `${teamId}:${key}`) — computable by any SDK,
// module, or external store without a lookup. Separate namespaces keep
// identity "acme" and group "acme" from ever colliding.

export const IDENTITY_NAMESPACE = "3e5a1f0a-9c7b-4b6e-8f21-6d2c4a7e9b10"
export const GROUP_NAMESPACE = "7c94d2b8-1e5f-4a83-b6d0-2f8a5c3e7d41"

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "")
  const bytes = new Uint8Array(16)
  for (let index = 0; index < 16; index++) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

export async function uuidv5(namespace: string, name: string): Promise<string> {
  const nameBytes = new TextEncoder().encode(name)
  const nsBytes = uuidBytes(namespace)
  const input = new Uint8Array(nsBytes.length + nameBytes.length)
  input.set(nsBytes)
  input.set(nameBytes, nsBytes.length)

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input))
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function identityId(teamId: string, key: string) {
  return uuidv5(IDENTITY_NAMESPACE, `${teamId}:${key}`)
}

export function groupId(teamId: string, key: string) {
  return uuidv5(GROUP_NAMESPACE, `${teamId}:${key}`)
}
