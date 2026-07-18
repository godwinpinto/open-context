import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

import { CLI_CLIENT_ID, createClient, resolveBaseURL } from "../client.js"
import { saveCredentials } from "../config.js"

type DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

type DeviceTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

type DeviceTokenError = {
  error:
    | "authorization_pending"
    | "slow_down"
    | "expired_token"
    | "access_denied"
    | "invalid_request"
    | "invalid_grant"
  error_description?: string
}

function openInBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open"
  try {
    spawn(command, [url], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    }).unref()
  } catch {
    // Best-effort — the user can still open the URL manually.
  }
}

export async function login(baseURLOverride?: string) {
  const baseURL = resolveBaseURL(baseURLOverride)
  const client = createClient(baseURL)

  const { data, error } = await client.device.code({
    client_id: CLI_CLIENT_ID,
  })
  if (error || !data) {
    console.error(
      "Failed to start device sign-in:",
      error?.error_description ?? error,
    )
    process.exitCode = 1
    return
  }
  const deviceCode = data as unknown as DeviceCodeResponse

  const url = deviceCode.verification_uri_complete ?? deviceCode.verification_uri
  console.log(`\nOpen this URL to sign in:\n\n  ${url}\n`)
  if (!deviceCode.verification_uri_complete) {
    console.log(`Enter this code when prompted: ${deviceCode.user_code}\n`)
  }
  openInBrowser(url)

  let intervalMs = deviceCode.interval * 1000
  const deadline = Date.now() + deviceCode.expires_in * 1000

  while (Date.now() < deadline) {
    await sleep(intervalMs)

    const { data: token, error: tokenError } = await client.device.token({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode.device_code,
      client_id: CLI_CLIENT_ID,
    })

    if (token) {
      const accessToken = token as unknown as DeviceTokenResponse
      saveCredentials({
        baseURL,
        token: accessToken.access_token,
        expiresIn: accessToken.expires_in,
      })
      console.log("Signed in.")
      return
    }

    const deviceError = tokenError as unknown as DeviceTokenError | undefined
    switch (deviceError?.error) {
      case "authorization_pending":
        continue
      case "slow_down":
        intervalMs += 5000
        continue
      case "access_denied":
        console.error("Sign-in was denied.")
        process.exitCode = 1
        return
      case "expired_token":
        console.error("The sign-in code expired. Run `open-context login` again.")
        process.exitCode = 1
        return
      default:
        console.error(
          "Sign-in failed:",
          deviceError?.error_description ?? deviceError,
        )
        process.exitCode = 1
        return
    }
  }

  console.error("Timed out waiting for sign-in.")
  process.exitCode = 1
}
