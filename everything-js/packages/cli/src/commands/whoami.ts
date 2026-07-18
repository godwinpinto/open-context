import { readCredentials } from "../config.js"

export async function whoami() {
  const creds = readCredentials()
  if (!creds) {
    console.error("Not signed in. Run `open-context login`.")
    process.exitCode = 1
    return
  }

  const res = await fetch(new URL("/api/auth/get-session", creds.baseURL), {
    headers: { Authorization: `Bearer ${creds.token}` },
  })
  if (!res.ok) {
    console.error("Session is no longer valid. Run `open-context login` again.")
    process.exitCode = 1
    return
  }

  const session = (await res.json()) as {
    user: { name: string; email: string }
  } | null
  if (!session) {
    console.error("Session is no longer valid. Run `open-context login` again.")
    process.exitCode = 1
    return
  }

  console.log(`${session.user.name} <${session.user.email}>`)
}
