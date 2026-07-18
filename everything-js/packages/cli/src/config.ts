import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const CONFIG_DIR = join(homedir(), ".open-context")
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json")

export type Credentials = {
  baseURL: string
  token: string
  expiresAt: string
}

export function saveCredentials(creds: {
  baseURL: string
  token: string
  expiresIn: number
}) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  const data: Credentials = {
    baseURL: creds.baseURL,
    token: creds.token,
    expiresAt: new Date(Date.now() + creds.expiresIn * 1000).toISOString(),
  }
  // Contains a bearer session token — owner-only permissions.
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2), {
    mode: 0o600,
  })
}

export function readCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"))
}

export function clearCredentials() {
  if (existsSync(CREDENTIALS_PATH)) rmSync(CREDENTIALS_PATH)
}
