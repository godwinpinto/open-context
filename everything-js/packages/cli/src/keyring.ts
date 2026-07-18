import { Entry } from "@napi-rs/keyring"

// macOS Keychain / Windows Credential Manager / Linux Secret Service.
const SERVICE = "open-context-cli"
const ACCOUNT = "credentials"

export function keyringSet(value: string): boolean {
  try {
    new Entry(SERVICE, ACCOUNT).setPassword(value)
    return true
  } catch {
    return false
  }
}

export function keyringGet(): string | null {
  try {
    return new Entry(SERVICE, ACCOUNT).getPassword()
  } catch {
    return null
  }
}

export function keyringDelete(): void {
  try {
    new Entry(SERVICE, ACCOUNT).deletePassword()
  } catch {
    // Nothing stored, or no keyring on this platform — fine either way.
  }
}
