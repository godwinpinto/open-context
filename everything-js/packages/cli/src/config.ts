import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { keyringDelete, keyringGet, keyringSet } from "./keyring.js"

const CONFIG_DIR = join(homedir(), ".open-context")
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json")

export type Credentials = {
  baseURL: string
  token: string
  expiresAt: string
}

export type CredentialStorage = "keyring" | "file"

export function saveCredentials(
  creds: { baseURL: string; token: string; expiresIn: number },
  options: { useKeyring?: boolean } = {},
): CredentialStorage {
  const data: Credentials = {
    baseURL: creds.baseURL,
    token: creds.token,
    expiresAt: new Date(Date.now() + creds.expiresIn * 1000).toISOString(),
  }
  const serialized = JSON.stringify(data, null, 2)

  if (options.useKeyring) {
    if (keyringSet(serialized)) {
      clearFile()
      return "keyring"
    }
    console.error(
      "Couldn't reach the OS keychain — falling back to a plaintext credentials file.",
    )
  }

  // Storing to file: make sure a stale keyring entry from a previous
  // --use-keyring login doesn't linger and get read back instead.
  keyringDelete()
  writeFile(serialized)
  return "file"
}

export function readCredentials(): Credentials | null {
  const fromKeyring = keyringGet()
  if (fromKeyring) return JSON.parse(fromKeyring)

  if (!existsSync(CREDENTIALS_PATH)) return null
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"))
}

export function clearCredentials() {
  keyringDelete()
  clearFile()
}

function writeFile(serialized: string) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  // Contains a bearer session token — owner-only permissions.
  writeFileSync(CREDENTIALS_PATH, serialized, { mode: 0o600 })
}

function clearFile() {
  if (existsSync(CREDENTIALS_PATH)) rmSync(CREDENTIALS_PATH)
}
