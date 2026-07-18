#!/usr/bin/env node
import { login } from "./commands/login.js"
import { logout } from "./commands/logout.js"
import { whoami } from "./commands/whoami.js"

const [, , command, ...rest] = process.argv

switch (command) {
  case "login":
    await login(rest[0])
    break
  case "logout":
    logout()
    break
  case "whoami":
    await whoami()
    break
  default:
    console.log("Usage: open-context <login|logout|whoami>")
    process.exitCode = command ? 1 : 0
}
