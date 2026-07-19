import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import { Input } from "@open-context/ui/components/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import { Skeleton } from "@open-context/ui/components/skeleton"

// Customer-facing portal: no session, no sidebar — a team's
// END-CUSTOMER lands here with a short-lived portal token minted by
// the team's backend (POST /api/identity/v1/portal-tokens). Designed
// to be opened directly or embedded in the team's own product.

type PortalMe = {
  identity: string
  scopes: string[]
  exp: number
}

type PortalUsage = {
  entitlements: {
    featureKey: string
    featureName: string
    hasAccess: boolean
    type: "metered" | "boolean"
    usage: number | null
    balance: number | null
    overage: number | null
    limit: number | null
    periodStart: string | null
    pools: { id: string; kind: "allowance" | "grant"; remaining: number }[]
  }[]
}

type PortalEndpoint = {
  id: string
  url: string
  description: string | null
  secret: string
  eventTypes: string[] | null
  disabled: boolean
  disabledReason: string | null
}

async function portalFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/portal${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export default function PortalPage({ token }: { token?: string }) {
  const me = useQuery({
    queryKey: ["portal", "me", token],
    queryFn: () => portalFetch<PortalMe>("/me", token!),
    enabled: Boolean(token),
    retry: false,
  })

  const usage = useQuery({
    queryKey: ["portal", "usage", token],
    queryFn: () => portalFetch<PortalUsage>("/meter/usage", token!),
    enabled: Boolean(token) && Boolean(me.data?.scopes.includes("meter:read")),
    retry: false,
  })

  if (!token || me.error) {
    return (
      <PortalShell>
        <Card>
          <CardHeader>
            <CardTitle>Portal unavailable</CardTitle>
            <CardDescription>
              {!token
                ? "No portal token was provided."
                : me.error instanceof Error
                  ? me.error.message
                  : "This link is invalid or has expired."}{" "}
              Ask for a fresh portal link and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </PortalShell>
    )
  }

  return (
    <PortalShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Usage portal</h1>
          {me.data ? (
            <p className="text-muted-foreground text-sm">
              Signed in as <span className="font-mono">{me.data.identity}</span>
            </p>
          ) : (
            <Skeleton className="mt-1 h-4 w-40" />
          )}
        </div>
        {me.data ? (
          <p className="text-muted-foreground text-xs">
            Link expires {new Date(me.data.exp * 1000).toLocaleString()}
          </p>
        ) : null}
      </div>

      {me.data?.scopes.includes("meter:read") ? (
        usage.isLoading || !usage.data ? (
          <Skeleton className="h-40 w-full" />
        ) : usage.data.entitlements.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No entitlements</CardTitle>
              <CardDescription>
                Nothing is provisioned for this account yet.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {usage.data.entitlements.map((entitlement) => (
              <EntitlementCard
                key={entitlement.featureKey}
                entitlement={entitlement}
              />
            ))}
          </div>
        )
      ) : null}

      {me.data?.scopes.includes("webhooks:manage") ? (
        <WebhooksPanel token={token} />
      ) : null}
    </PortalShell>
  )
}

// Svix App Portal-style self-service: the end-customer manages the
// webhook endpoints THEY receive on, scoped to the token's identity.
function WebhooksPanel({ token }: { token: string }) {
  const queryClient = useQueryClient()
  const endpoints = useQuery({
    queryKey: ["portal", "webhook-endpoints", token],
    queryFn: () =>
      portalFetch<{ endpoints: PortalEndpoint[] }>(
        "/webhooks/endpoints",
        token,
      ),
    retry: false,
  })
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["portal", "webhook-endpoints", token],
    })

  const [url, setUrl] = useState("")
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () =>
      portalFetch<{ endpoint: PortalEndpoint }>("/webhooks/endpoints", token, {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    onSuccess: (result) => {
      setUrl("")
      setRevealedSecret(result.endpoint.secret)
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      portalFetch<{ deleted: boolean }>(`/webhooks/endpoints/${id}`, token, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Webhook endpoints</CardTitle>
        <CardDescription>
          Where we deliver event notifications for your account. Deliveries
          are signed (Standard Webhooks).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/webhooks"
          />
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !url}
          >
            {create.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
        {create.error ? (
          <p className="text-destructive text-sm">{create.error.message}</p>
        ) : null}
        {revealedSecret ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Signing secret:</p>
            <code className="bg-muted block break-all rounded p-2 text-xs">
              {revealedSecret}
            </code>
          </div>
        ) : null}
        {(endpoints.data?.endpoints ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No endpoints yet.</p>
        ) : (
          <div className="space-y-2">
            {endpoints.data!.endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{endpoint.url}</p>
                  {endpoint.disabled ? (
                    <Badge
                      variant="destructive"
                      title={endpoint.disabledReason ?? undefined}
                    >
                      Disabled
                    </Badge>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => remove.mutate(endpoint.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-svh">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        {children}
      </div>
    </div>
  )
}

function EntitlementCard({
  entitlement,
}: {
  entitlement: PortalUsage["entitlements"][number]
}) {
  const { featureName, featureKey, hasAccess, type, usage, balance, limit } =
    entitlement
  const percentUsed =
    type === "metered" && limit != null && limit > 0 && usage != null
      ? Math.min(100, Math.round((usage / limit) * 100))
      : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{featureName}</CardTitle>
          <Badge variant={hasAccess ? "secondary" : "destructive"}>
            {hasAccess ? "Active" : "Exhausted"}
          </Badge>
        </div>
        <CardDescription className="font-mono text-xs">
          {featureKey}
        </CardDescription>
      </CardHeader>
      {type === "metered" ? (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Used</p>
              <p className="font-medium">{usage ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Remaining</p>
              <p className="font-medium">{balance ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Limit</p>
              <p className="font-medium">{limit ?? "Unlimited"}</p>
            </div>
          </div>
          {percentUsed != null ? (
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className={
                  percentUsed >= 100
                    ? "bg-destructive h-full"
                    : percentUsed >= 80
                      ? "h-full bg-amber-500"
                      : "bg-primary h-full"
                }
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}
