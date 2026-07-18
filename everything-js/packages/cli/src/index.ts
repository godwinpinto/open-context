#!/usr/bin/env node
import { login } from "./commands/login.js"
import { logout } from "./commands/logout.js"
import { whoami } from "./commands/whoami.js"

const [, , command, ...rest] = process.argv

switch (command) {
  case "login": {
    const flags = new Set(rest.filter((arg) => arg.startsWith("--")))
    const baseURL = rest.find((arg) => !arg.startsWith("--"))
    await login({ baseURL, useKeyring: flags.has("--use-keyring") })
    break
  }
  case "logout":
    logout()
    break
  case "whoami":
    await whoami()
    break
  default:
    console.log("Usage: open-context <login|logout|whoami> [--use-keyring]")
    process.exitCode = command ? 1 : 0
}
