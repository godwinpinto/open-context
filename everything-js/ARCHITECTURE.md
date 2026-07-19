# Open Context — Architecture

A product OS platform (PostHog-style) built as a **modular monolith** on
Cloudflare Workers, structured like better-auth: modules are packages
that contribute capabilities, not deployments.

## Layout

```
apps/
  admin/              The one deployed app: auth, org/team admin, all module UIs
packages/
  ui/                 @open-context/ui — shadcn primitives + theme (shared shell)
  cli/                open-context CLI (device-code login, bearer auth)
  modules/
    trail/            @open-context/module-trail — reference module
  plugins/            (reserved)
```

## The module pattern

Each module under `packages/modules/*` exports:

| Export | What | Mounted at |
|---|---|---|
| `schema` | Drizzle fragment (standalone, no FKs into auth tables; every table has `teamId`) | re-exported from admin's `schema.ts` → one migration stream |
| `<mod>AdminRouter` | oRPC router, session-authenticated | `/api/{mod}/admin/*` via `RPCHandler` |
| `<mod>ConsumerRouter` | oRPC router, API-key-authenticated, versioned | `/api/{mod}/v1/*` via `OpenAPIHandler` (REST, curl-able) |

**The host owns all authentication.** Modules receive an authenticated
context and never see cookies or API keys:

- Admin context: `{ db, userId, assertTeamAccess(teamId) }` — every
  admin procedure takes `teamId` as input and must call
  `assertTeamAccess` first.
- Consumer context: `{ db, teamId }` — team scope comes from the API
  key's `metadata.teamId`, resolved by the host. The URL/body can never
  vary the scope.

Module UIs live in admin's route tree at
`/o/$orgId/t/$teamId/{mod}/*` with `ssr: false` (shell SSRs, module
pane renders client-side — module deps never need SSR compatibility).
The typed admin client (`RouterClient<typeof router>` over `RPCLink`)
gives the UI end-to-end types.

MCP tools (future): derived from consumer procedures' zod contracts,
aggregated at a single `/api/mcp` endpoint behind the OAuth provider.

## URL namespace (reserved prefixes)

- `/`, `/dashboard`, `/onboarding`, `/two-factor`, `/device`, `/consent` — admin core
- `/o/$orgId/t/$teamId/...` — team-scoped UI; `manage` + `account` are
  admin's; each module owns `/o/../t/../{moduleId}/*`
- `/api/auth/*` — better-auth (never touch)
- `/api/{moduleId}/admin/*` and `/api/{moduleId}/v1/*` — module APIs
- `/.well-known/*` — OAuth discovery

## Auth surfaces

| Caller | Mechanism |
|---|---|
| Admin UI (browser) | better-auth session cookie (+ optional TOTP 2FA) |
| CLI | device-code flow → bearer session token (`bearer()` plugin) |
| SDKs / CI / tools | API key `x-api-key` (`oc_sk_` prefix, hashed at rest, per-key rate limits, `metadata.teamId` scope) |
| MCP clients | OAuth 2.1 provider (dynamic registration + PKCE) |

## Free-tier accounting (measured)

- Client assets: free, unmetered. Worker requests: SSR docs + API calls
  only; module navigation is SPA (no doc loads).
- Server bundle: ~844 KB gzip base; each UI route ≈ 2 KB gzip.
  **`ssr: false` does NOT remove route code from the server bundle**
  (measured; known upstream: TanStack/router#6400) — it only skips
  execution. Mitigation (verified, see the trail route): keep the route
  file a thin shell and load the page body via an SSR-guarded lazy
  import —
  `lazy(() => import.meta.env.SSR ? stub : import("./-page"))` —
  `import.meta.env.SSR` is replaced at build time, so the page chunk
  and its deps are dead-code-eliminated from the server build. Module
  pages with heavy client-only deps (charts, editors) MUST use this
  pattern; the worker then only carries the ~1 KB shells.

## Scaling escape hatches (proven, not active)

- Path-routed separate workers (`openctx.encatch.dev/{prefix}*` zone
  routes beat the admin Custom Domain) — used for the retired
  `apps/trail` MFE experiment; see git history. Reach for it when a
  module needs independent deploys or its ingest volume demands its own
  worker + D1 database.
- Cross-document view transitions + shared `@open-context/ui` shell
  keep multi-worker UX seamless if that day comes.
