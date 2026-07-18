// Extends the Wrangler-generated `Env` (worker-configuration.d.ts, gitignored)
// with bindings that are never written to wrangler.jsonc: BETTER_AUTH_SECRET
// is set via `wrangler secret put` / `.dev.vars`, never committed.
interface __BaseEnv_Env {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
}
