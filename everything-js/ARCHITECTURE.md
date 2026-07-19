# Open Context — Architecture

A product OS platform (PostHog-style) built as a **modular monolith** on
Cloudflare Workers, structured like better-auth: modules are packages
that contribute capabilities, not deployments.

## Layout

```
apps/
  admin/              The main app: auth, org/team admin, all module UIs
  mcp/                MCP gateway — separate worker (Hono), /mcp* on the same hostname
packages/
  core/               @open-context/core — platform substrate (identity layer)
  ui/                 @open-context/ui — shadcn primitives + theme (shared shell)
  cli/                open-context CLI (device-code login, bearer auth)
  modules/
    trail/            @open-context/module-trail — reference module (behavior analytics)
    meter/            @open-context/module-meter — usage metering + entitlements
    experiments/      @open-context/module-experiments — A/B testing
    flags/            @open-context/module-flags — feature flags
  plugins/            (reserved)
```

### Core identity layer

Dependency rule: modules depend on core, never on each other. The
first core concern is IDENTITY — who usage is about:

- **Identity** = any principal the customer's product identifies
  (person, service account, device), keyed by an immutable `key`.
- **Group** = a set of identities with shared properties (Segment
  group() / PostHog Groups).
- IDs are deterministic `uuidv5(namespace, teamId + ":" + key)` —
  computable anywhere (SDK, module, ClickHouse) without a lookup;
  creation is idempotent. Tables: `oc_identity`, `oc_group`,
  `oc_identity_group`.
- Property ops: `set / setOnce / unset / increment` (negative =
  decrement) — state, not usage (counting belongs to Meter), so
  mutable rows with last-write-wins are intended semantics.
- Consumer API: `/api/identity/v1/{identify,group,attach,identities/{key}}`.
  Property resolution for consumers (flags evaluation etc.): group
  properties merged under identity properties, identity wins; groups
  merge in attachment order.
- Modules reference identities loosely by (teamId, key): Trail's
  `distinctId` and Meter's `subject` ARE identity keys — joins by
  convention or by deriving the uuid, no FKs, and modules may import
  `getMergedProperties` etc. from @open-context/core directly.

### Segments (core concern #2)

Named predicates over identities — the shared filter primitive every
module consumes (flags targeting, metered grants, event filtering).
Tables `oc_segment` + `oc_segment_identity`; two types:

- **dynamic** — rules over MERGED properties (traits only; behavioral
  conditions are a future concern via module-registered condition
  resolvers — the `type` discriminator in rule JSON leaves room).
  Flat `{match: all|any, conditions[]}` with Flagsmith-compatible
  operators plus a `split` condition for percentage rollouts.
- **manual** — explicit membership; members addable by identity key
  OR uuid (interchangeable via deterministic IDs; unknown keys are
  upserted).

**FROZEN CONTRACTS** (segments/rules.ts): split bucketing is FNV-1a
32-bit over `segmentId:identityKey` mod 100; weighted variant
assignment (`variantFor`, used by experiments now and multivariate
flags later) is the same FNV over `scopeId:identityKey` mod 10000
against cumulative-weight thresholds. Changing either reshuffles live
rollouts/experiments — never touch; a new algorithm is a new
condition/assignment type.

### Flags module

Flagsmith-inspired. Flags defined per team; STATE (enabled + optional
JSON serve value) per environment. An API key IS an environment key —
`metadata.environment` selects it (default "production"); the host's
consumerCallContext exposes full key metadata for such module-specific
dimensions. Evaluation precedence: identity override → segment
overrides (priority asc) → environment default (missing state row =
disabled). `POST /api/flags/v1/evaluate { identity, traits? }` returns
all flags in one call; request traits merge OVER stored merged
properties for segment matching. Percentage rollouts = segments with
split conditions; multivariate = Experiments module (shared variantFor
when flags grow variants). Admin testEvaluate returns per-flag source
attribution for debugging.

### Experiments module

Sticky assignment via `variantFor` (no assignment storage — exposures
recorded server-side at assign time, deduped per identity), optional
segment targeting (non-members get null), explicit conversions via
`POST /api/experiments/v1/goal` (only counted for exposed identities,
first per identity). Results: per-variant conversion rates, Bayesian
chance-to-beat-control (Beta-Binomial Monte Carlo), two-proportion
z-test p-value, and SRM detection (chi-square on exposure counts vs
weights; p < 0.001 flags results as unreliable). Variants are
immutable once running.

Evaluation is dynamic (no materialization): per-identity checks are
one merged-props fetch + in-memory rule eval
(`identityInSegments`); admin membership listing is scan+evaluate
(fine to ~tens of thousands of identities; materialized membership is
a ClickHouse-era optimization). The consumer resolve endpoint
(`GET /api/identity/v1/identities/{key}`) returns `segments: []`
alongside merged properties — one call powers SDK-side gating.

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

### Event storage & connectors (Meter)

`meter_event` mirrors OpenMeter's ClickHouse `om_events` layout
(namespace=teamId, id, type, subject, source, time, raw JSON data) and
meters extract `valueProperty` at query time (`json_extract` ↔
`JSONExtract`). All event I/O goes through the module's `EventStore`
interface; the host constructs it per team in `lib/modules/meter.ts` —
that call site is where the planned per-team **connectors** feature
plugs in: a team with a ClickHouse connector configured gets a
ClickHouse store, everyone else stays on D1. Entitlement balances are
event-derived ("derived counter"): increment = ingest event, decrement
= negative value, idempotent via (teamId, source, id) dedup — never a
mutable counter column.

## URL namespace (reserved prefixes)

- `/`, `/dashboard`, `/onboarding`, `/two-factor`, `/device`, `/consent` — admin core
- `/portal` — customer-facing portal (portal-token auth, no session);
  `/api/portal/*` its API
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
| End-customers (portal) | Stateless portal token `oc_pt_` — HMAC(BETTER_AUTH_SECRET)-signed claims {teamId, identity, scopes, exp}; minted by the team's backend via `POST /api/identity/v1/portal-tokens`; no DB row, revocation = expiry/secret rotation |

## Portal (core) + Webhooks (module over a core engine)

- Portal: `/portal?token=...` renders scope-gated panels — `meter:read`
  → entitlement usage (OpenMeter-style), `webhooks:manage` → endpoint
  self-service (Svix App Portal-style). API under `/api/portal/*`.
- Webhook engine lives in core (`webhooks/{schema,sign,engine}.ts`,
  tables `oc_webhook_endpoint|message|attempt`): one pub/sub-over-HTTP
  outbox with three variants keyed by endpoint owner — team (platform
  notifications), identity/group (webhooks-as-a-service, Svix's
  "application" ≈ our identity). Standard Webhooks signing (`whsec_`
  secrets, `webhook-id`/`-timestamp`/`-signature` headers) so standard
  receiver libraries verify out of the box.
- **No cron**: first attempt runs inline via `waitUntil`
  (`cloudflare:workers` module-level export, feature-detected with a
  fire-and-forget fallback for Node). Retries (30s→5m→30m→2h→5h→10h,
  then exhausted) are swept opportunistically: any `/api/webhooks/v1/*`
  traffic defers a sweep, `POST /v1/sweep` and the dashboard's
  "Deliver due now"/Replay do it explicitly. Endpoints auto-disable
  after 5 consecutive exhausted messages; re-enabling resets the count.
  Cron/Queues remain a documented later option if traffic-driven
  sweeping proves too lazy.
- `@open-context/module-webhooks` is thin routers over the core engine
  (consumer: send/endpoints CRUD/sweep; admin: endpoints, delivery log,
  rotate secret, replay).

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

## MCP gateway (apps/mcp)

A SEPARATE worker — the module-UI monolith arguments (SPA navigation,
shared session cookies, shell duplication) don't apply to a UI-less
protocol gateway, while isolation ones do (streaming connections from
third-party AI clients, own bundle budget, protocol-chasing deploy
cadence). Built on Hono + @hono/mcp + @modelcontextprotocol/sdk —
fetch-native and URL-based throughout, so the same code runs on Node
behind @hono/node-server.

- Mounted at `openctx.encatch.dev/mcp*` (zone route beats admin's
  Custom Domain); same-origin keeps admin's /.well-known OAuth
  discovery valid. Admin serves /.well-known/oauth-protected-resource
  (RFC 9728) and the gateway's 401 carries the WWW-Authenticate
  pointer.
- Auth: OAuth 2.1 access tokens from admin's provider, validated via
  ADMIN_URL userinfo (env var, not a service binding — portability).
- Tools call module procedures IN-PROCESS via oRPC `call()` with a
  host-built context (shared D1 binding, own copy of the
  team-membership guard) — the modular monolith running in a second
  host, zero duplicated business logic. Stateless per-request
  McpServer; tool closures carry the authenticated user.
- v1 toolset: list_teams, identity_get, segments_list, trail_events,
  meter_entitlement_value (D1 store only — ClickHouse-connector teams
  should use the dashboard), experiments_results, flags_evaluate, and
  one write: flags_set_state.

## Scaling escape hatches (proven, not active)

- Path-routed separate workers (`openctx.encatch.dev/{prefix}*` zone
  routes beat the admin Custom Domain) — used for the retired
  `apps/trail` MFE experiment; see git history. Reach for it when a
  module needs independent deploys or its ingest volume demands its own
  worker + D1 database.
- Cross-document view transitions + shared `@open-context/ui` shell
  keep multi-worker UX seamless if that day comes.
