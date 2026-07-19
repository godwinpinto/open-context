import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

// Per-team external backends ("connectors"). config is a
// symmetrically-encrypted JSON blob (better-auth crypto with the auth
// secret) — credentials never sit in plaintext at rest and are never
// returned by APIs after creation. One connector per type per team.
export const connector = sqliteTable(
  "connector",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    // "clickhouse" for now; future: kafka, s3, ...
    type: text("type").notNull(),
    config: text("config").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("connector_team_type_idx").on(table.teamId, table.type),
  ],
)

// Core identity layer (identities + groups) — platform substrate all
// modules reference by (teamId, key).
export {
  coreGroup,
  coreIdentity,
  coreIdentityGroup,
} from "@open-context/core/schema"
export {
  coreSegment,
  coreSegmentIdentity,
} from "@open-context/core"

// Module schema fragments — re-exported so drizzle-kit migrations and
// the drizzle client cover module tables too.
export { trailEvent } from "@open-context/module-trail/schema"
export {
  meter,
  meterEntitlement,
  meterEvent,
  meterFeature,
  meterGrant,
} from "@open-context/module-meter/schema"
export {
  expExperiment,
  expExposure,
  expGoal,
} from "@open-context/module-experiments/schema"

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // twoFactor() plugin
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(
    false,
  ),
})

// twoFactor() plugin — TOTP secrets and hashed backup codes
export const twoFactor = sqliteTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: integer("verified", { mode: "boolean" }).default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // organization() plugin
  activeOrganizationId: text("active_organization_id"),
  activeTeamId: text("active_team_id"),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})

// jwt() plugin — signing keys for OAuth/OIDC access and id tokens
export const jwks = sqliteTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
})

// oauthProvider() plugin — OAuth 2.1 / OIDC provider tables
export const oauthClient = sqliteTable("oauth_client", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  skipConsent: integer("skip_consent", { mode: "boolean" }),
  enableEndSession: integer("enable_end_session", { mode: "boolean" }),
  subjectType: text("subject_type"),
  scopes: text("scopes", { mode: "json" }).$type<string[]>(),
  userId: text("user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  contacts: text("contacts", { mode: "json" }).$type<string[]>(),
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  redirectUris: text("redirect_uris", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  postLogoutRedirectUris: text("post_logout_redirect_uris", {
    mode: "json",
  }).$type<string[]>(),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  grantTypes: text("grant_types", { mode: "json" }).$type<string[]>(),
  responseTypes: text("response_types", { mode: "json" }).$type<string[]>(),
  public: integer("public", { mode: "boolean" }),
  type: text("type"),
  requirePKCE: integer("require_pkce", { mode: "boolean" }),
  referenceId: text("reference_id"),
  metadata: text("metadata", { mode: "json" }),
})

export const oauthRefreshToken = sqliteTable("oauth_refresh_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId),
  sessionId: text("session_id").references(() => session.id, {
    onDelete: "set null",
  }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  referenceId: text("reference_id"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  revoked: integer("revoked", { mode: "timestamp" }),
  authTime: integer("auth_time", { mode: "timestamp" }),
  scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
})

export const oauthAccessToken = sqliteTable("oauth_access_token", {
  id: text("id").primaryKey(),
  token: text("token").unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId),
  sessionId: text("session_id").references(() => session.id, {
    onDelete: "set null",
  }),
  userId: text("user_id").references(() => user.id),
  referenceId: text("reference_id"),
  refreshId: text("refresh_id").references(() => oauthRefreshToken.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
})

export const oauthConsent = sqliteTable("oauth_consent", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId),
  userId: text("user_id").references(() => user.id),
  referenceId: text("reference_id"),
  scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})

// organization() plugin — organizations, teams (~ PostHog projects), members
export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  metadata: text("metadata"),
})

export const team = sqliteTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})

export const teamMember = sqliteTable("team_member", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" }),
})

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  role: text("role").notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id),
  email: text("email").notNull(),
  role: text("role"),
  teamId: text("team_id"),
  status: text("status").notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id),
})

// apiKey() plugin — static keys for non-interactive callers (other tools).
// referenceId is the owning user's id (plugin default `references: "user"`).
export const apikey = sqliteTable("apikey", {
  id: text("id").primaryKey(),
  configId: text("config_id").notNull().default("default"),
  name: text("name"),
  start: text("start"),
  prefix: text("prefix"),
  key: text("key").notNull(),
  referenceId: text("reference_id").notNull(),
  refillInterval: integer("refill_interval"),
  refillAmount: integer("refill_amount"),
  lastRefillAt: integer("last_refill_at", { mode: "timestamp" }),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  rateLimitEnabled: integer("rate_limit_enabled", { mode: "boolean" }).default(
    true,
  ),
  rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
  rateLimitMax: integer("rate_limit_max").default(10),
  requestCount: integer("request_count").default(0),
  remaining: integer("remaining"),
  lastRequest: integer("last_request", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  permissions: text("permissions"),
  metadata: text("metadata"),
})

// deviceAuthorization() plugin — RFC 8628 device code flow (CLI login)
export const deviceCode = sqliteTable("device_code", {
  id: text("id").primaryKey(),
  deviceCode: text("device_code").notNull(),
  userCode: text("user_code").notNull(),
  userId: text("user_id").references(() => user.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  status: text("status").notNull(),
  lastPolledAt: integer("last_polled_at", { mode: "timestamp" }),
  pollingInterval: integer("polling_interval"),
  clientId: text("client_id"),
  scope: text("scope"),
})

// dynamicAccessControl — custom, per-organization roles with their own
// resource/action permission sets, in addition to the built-in
// owner/admin/member roles.
export const organizationRole = sqliteTable("organization_role", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id),
  role: text("role").notNull(),
  permission: text("permission").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})
