import { clearCredentials } from "../config.js"

export function logout() {
  clearCredentials()
  console.log("Signed out.")
}
