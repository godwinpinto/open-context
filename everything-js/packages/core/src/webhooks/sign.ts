// Standard Webhooks (standardwebhooks.com) signing — the same scheme
// Svix uses, so any standard receiver library verifies our deliveries:
//   webhook-id: msg id
//   webhook-timestamp: unix seconds
//   webhook-signature: v1,base64(hmacSHA256(key, `${id}.${ts}.${body}`))
// where key = base64decode(secret minus the whsec_ prefix).

const encoder = new TextEncoder()

function base64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64decode(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `whsec_${base64(bytes)}`
}

export async function signWebhook(options: {
  secret: string
  messageId: string
  timestamp: number // unix seconds
  payload: string
}): Promise<string> {
  const raw = options.secret.startsWith("whsec_")
    ? options.secret.slice(6)
    : options.secret
  const key = await crypto.subtle.importKey(
    "raw",
    base64decode(raw) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const content = `${options.messageId}.${options.timestamp}.${options.payload}`
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(content)),
  )
  return `v1,${base64(signature)}`
}
