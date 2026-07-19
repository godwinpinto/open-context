import { and, eq, inArray, lte, sql } from "drizzle-orm"

import type { CoreDatabase } from "../identity/context"
import {
  coreWebhookAttempt,
  coreWebhookEndpoint,
  coreWebhookMessage,
} from "./schema"
import { generateWebhookSecret, signWebhook } from "./sign"

export type WebhookOwner = {
  // team-owned endpoints receive platform notifications; identity/
  // group-owned endpoints belong to the team's own customers.
  ownerType: "team" | "identity" | "group"
  ownerKey?: string
}

// Svix-flavored backoff, compressed for opportunistic (traffic-driven)
// sweeping: attempt N failing schedules attempt N+1 this far out.
// After the last slot the attempt is EXHAUSTED (manual replay only).
const RETRY_SCHEDULE_SECONDS = [30, 300, 1800, 7200, 18000, 36000]
const AUTO_DISABLE_AFTER = 5 // consecutive exhausted messages

export function assertValidEndpointUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "Invalid URL"
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "URL must be http(s)"
  }
  if (parsed.username || parsed.password) {
    return "URL must not embed credentials"
  }
  return null
}

export async function createWebhookEndpoint(
  db: CoreDatabase,
  teamId: string,
  input: WebhookOwner & {
    url: string
    description?: string
    eventTypes?: string[] | null
  },
) {
  const invalid = assertValidEndpointUrl(input.url)
  if (invalid) throw new Error(invalid)
  const now = new Date()
  const endpoint = {
    id: crypto.randomUUID(),
    teamId,
    ownerType: input.ownerType,
    ownerKey: input.ownerKey ?? "",
    url: input.url,
    description: input.description ?? null,
    secret: generateWebhookSecret(),
    eventTypes: input.eventTypes ?? null,
    disabled: false,
    disabledReason: null,
    consecutiveFailures: 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(coreWebhookEndpoint).values(endpoint)
  return endpoint
}

export async function rotateWebhookSecret(
  db: CoreDatabase,
  teamId: string,
  endpointId: string,
) {
  const secret = generateWebhookSecret()
  await db
    .update(coreWebhookEndpoint)
    .set({ secret, updatedAt: new Date() })
    .where(
      and(
        eq(coreWebhookEndpoint.teamId, teamId),
        eq(coreWebhookEndpoint.id, endpointId),
      ),
    )
  return secret
}

// Publish: write the message + one pending attempt per matching
// enabled endpoint. Pure D1 writes — delivery happens separately so
// the caller controls timing (inline waitUntil for freshness, sweep
// for retries).
export async function publishWebhook(
  db: CoreDatabase,
  teamId: string,
  input: WebhookOwner & { eventType: string; payload: unknown },
) {
  const endpoints = await db
    .select()
    .from(coreWebhookEndpoint)
    .where(
      and(
        eq(coreWebhookEndpoint.teamId, teamId),
        eq(coreWebhookEndpoint.ownerType, input.ownerType),
        eq(coreWebhookEndpoint.ownerKey, input.ownerKey ?? ""),
        eq(coreWebhookEndpoint.disabled, false),
      ),
    )
  const matching = endpoints.filter(
    (endpoint) =>
      !endpoint.eventTypes || endpoint.eventTypes.includes(input.eventType),
  )

  const now = new Date()
  const message = {
    id: `msg_${crypto.randomUUID().replace(/-/g, "")}`,
    teamId,
    ownerType: input.ownerType,
    ownerKey: input.ownerKey ?? "",
    eventType: input.eventType,
    payload: JSON.stringify(input.payload),
    createdAt: now,
  }
  await db.insert(coreWebhookMessage).values(message)

  if (matching.length > 0) {
    await db.insert(coreWebhookAttempt).values(
      matching.map((endpoint) => ({
        id: crypto.randomUUID(),
        teamId,
        messageId: message.id,
        endpointId: endpoint.id,
        status: "pending",
        attemptNumber: 0,
        nextAttemptAt: now.getTime(),
        createdAt: now,
        updatedAt: now,
      })),
    )
  }
  return { messageId: message.id, endpointCount: matching.length }
}

async function executeDelivery(options: {
  url: string
  secret: string
  messageId: string
  eventType: string
  payload: string
}): Promise<{ ok: boolean; httpStatus: number | null; snippet: string }> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await signWebhook({
    secret: options.secret,
    messageId: options.messageId,
    timestamp,
    payload: options.payload,
  })
  try {
    const response = await fetch(options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": options.messageId,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": signature,
        "x-event-type": options.eventType,
      },
      body: options.payload,
      signal: AbortSignal.timeout(10_000),
    })
    const snippet = (await response.text().catch(() => "")).slice(0, 200)
    return {
      ok: response.status >= 200 && response.status < 300,
      httpStatus: response.status,
      snippet,
    }
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      snippet: error instanceof Error ? error.message.slice(0, 200) : "fetch failed",
    }
  }
}

// Deliver every due attempt for a team (pending/failed with
// nextAttemptAt <= now). Called inline after publish (first attempt is
// immediately due), from the opportunistic sweep on consumer traffic,
// and from the admin UI's manual "deliver now". No cron by design.
export async function deliverDueWebhooks(
  db: CoreDatabase,
  teamId: string,
  limit = 20,
) {
  const now = Date.now()
  const due = await db
    .select({
      attempt: coreWebhookAttempt,
      message: coreWebhookMessage,
      endpoint: coreWebhookEndpoint,
    })
    .from(coreWebhookAttempt)
    .innerJoin(
      coreWebhookMessage,
      eq(coreWebhookAttempt.messageId, coreWebhookMessage.id),
    )
    .innerJoin(
      coreWebhookEndpoint,
      eq(coreWebhookAttempt.endpointId, coreWebhookEndpoint.id),
    )
    .where(
      and(
        eq(coreWebhookAttempt.teamId, teamId),
        inArray(coreWebhookAttempt.status, ["pending", "failed"]),
        lte(coreWebhookAttempt.nextAttemptAt, now),
      ),
    )
    .limit(limit)

  let delivered = 0
  let failed = 0
  for (const { attempt, message, endpoint } of due) {
    if (endpoint.disabled) continue
    const result = await executeDelivery({
      url: endpoint.url,
      secret: endpoint.secret,
      messageId: message.id,
      eventType: message.eventType,
      payload: message.payload,
    })
    const attemptNumber = attempt.attemptNumber + 1
    const timestamp = new Date()

    if (result.ok) {
      delivered++
      await db
        .update(coreWebhookAttempt)
        .set({
          status: "success",
          attemptNumber,
          httpStatus: result.httpStatus,
          responseSnippet: result.snippet,
          updatedAt: timestamp,
        })
        .where(eq(coreWebhookAttempt.id, attempt.id))
      await db
        .update(coreWebhookEndpoint)
        .set({ consecutiveFailures: 0, updatedAt: timestamp })
        .where(eq(coreWebhookEndpoint.id, endpoint.id))
      continue
    }

    failed++
    const retryDelay = RETRY_SCHEDULE_SECONDS[attemptNumber - 1]
    if (retryDelay !== undefined) {
      await db
        .update(coreWebhookAttempt)
        .set({
          status: "failed",
          attemptNumber,
          httpStatus: result.httpStatus,
          responseSnippet: result.snippet,
          nextAttemptAt: now + retryDelay * 1000,
          updatedAt: timestamp,
        })
        .where(eq(coreWebhookAttempt.id, attempt.id))
    } else {
      // Out of retries — exhausted; only a manual replay recreates it.
      await db
        .update(coreWebhookAttempt)
        .set({
          status: "exhausted",
          attemptNumber,
          httpStatus: result.httpStatus,
          responseSnippet: result.snippet,
          updatedAt: timestamp,
        })
        .where(eq(coreWebhookAttempt.id, attempt.id))
      const failures = endpoint.consecutiveFailures + 1
      await db
        .update(coreWebhookEndpoint)
        .set({
          consecutiveFailures: failures,
          ...(failures >= AUTO_DISABLE_AFTER
            ? {
                disabled: true,
                disabledReason: `Auto-disabled after ${failures} consecutive undeliverable messages`,
              }
            : {}),
          updatedAt: timestamp,
        })
        .where(eq(coreWebhookEndpoint.id, endpoint.id))
    }
  }
  return { due: due.length, delivered, failed }
}

// Manual replay: fresh pending attempt for (message, endpoint),
// immediately due. Used by the admin UI and after re-enabling an
// endpoint.
export async function replayWebhookMessage(
  db: CoreDatabase,
  teamId: string,
  messageId: string,
  endpointId: string,
) {
  const now = new Date()
  await db.insert(coreWebhookAttempt).values({
    id: crypto.randomUUID(),
    teamId,
    messageId,
    endpointId,
    status: "pending",
    attemptNumber: 0,
    nextAttemptAt: now.getTime(),
    createdAt: now,
    updatedAt: now,
  })
}

// Cheap probe used to decide whether a piggybacked sweep is worth
// scheduling at all (most consumer requests should skip straight past
// webhooks).
export async function hasDueWebhooks(
  db: CoreDatabase,
  teamId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(coreWebhookAttempt)
    .where(
      and(
        eq(coreWebhookAttempt.teamId, teamId),
        inArray(coreWebhookAttempt.status, ["pending", "failed"]),
        lte(coreWebhookAttempt.nextAttemptAt, Date.now()),
      ),
    )
    .limit(1)
  return (row?.count ?? 0) > 0
}
