import { useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { PlusIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@open-context/ui/components/alert-dialog"
import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@open-context/ui/components/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@open-context/ui/components/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@open-context/ui/components/field"
import { Input } from "@open-context/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-context/ui/components/select"
import { Spinner } from "@open-context/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@open-context/ui/components/table"
import { meterClient } from "@/lib/modules/meter-client"

const AGGREGATIONS = [
  "sum",
  "count",
  "unique_count",
  "avg",
  "min",
  "max",
] as const

// Section navigation lives in the sidebar (contextual menu); the tab
// arrives via the route's ?tab= search param.
export default function MeterPage({
  teamId,
  tab,
}: {
  teamId: string
  tab: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Meter</h1>
        <p className="text-sm text-muted-foreground">
          Usage metering and entitlements.
        </p>
      </div>
      {tab === "meters" && <MetersTab teamId={teamId} />}
      {tab === "events" && <EventsTab teamId={teamId} />}
      {tab === "entitlements" && <EntitlementsTab teamId={teamId} />}
    </div>
  )
}

// ——— Meters ———

function MetersTab({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const metersQuery = useQuery({
    queryKey: ["meter-meters", teamId],
    queryFn: () => meterClient.listMeters({ teamId }),
  })
  const meters = metersQuery.data?.meters ?? []

  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [aggregation, setAggregation] =
    useState<(typeof AGGREGATIONS)[number]>("sum")
  const [eventType, setEventType] = useState("")
  const [valueProperty, setValueProperty] = useState("$.value")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      meterClient.createMeter({
        teamId,
        slug,
        name,
        aggregation,
        eventType,
        valueProperty:
          aggregation === "count" ? undefined : valueProperty || undefined,
      }),
    onSuccess: () => {
      setOpen(false)
      setSlug("")
      setName("")
      setEventType("")
      setError(null)
      queryClient.invalidateQueries({ queryKey: ["meter-meters", teamId] })
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  const remove = useMutation({
    mutationFn: (meterId: string) =>
      meterClient.deleteMeter({ teamId, meterId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["meter-meters", teamId] }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={(props) => (
              <Button size="sm" {...props}>
                <PlusIcon data-icon="inline-start" />
                New meter
              </Button>
            )}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create meter</DialogTitle>
              <DialogDescription>
                A meter matches events by type and aggregates a value from them.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                create.mutate()
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="meter-slug">Slug</FieldLabel>
                  <Input
                    id="meter-slug"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="tokens_used"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="meter-name">Name</FieldLabel>
                  <Input
                    id="meter-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Tokens used"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="meter-aggregation">
                    Aggregation
                  </FieldLabel>
                  <Select
                    value={aggregation}
                    onValueChange={(value) =>
                      value &&
                      setAggregation(value as (typeof AGGREGATIONS)[number])
                    }
                  >
                    <SelectTrigger id="meter-aggregation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGGREGATIONS.map((agg) => (
                        <SelectItem key={agg} value={agg}>
                          {agg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="meter-event-type">Event type</FieldLabel>
                  <Input
                    id="meter-event-type"
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                    placeholder="llm.completion"
                    required
                  />
                </Field>
                {aggregation !== "count" && (
                  <Field>
                    <FieldLabel htmlFor="meter-value-prop">
                      Value property (JSON path)
                    </FieldLabel>
                    <Input
                      id="meter-value-prop"
                      value={valueProperty}
                      onChange={(event) => setValueProperty(event.target.value)}
                      placeholder="$.tokens"
                      required
                    />
                  </Field>
                )}
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent>
          {meters.length === 0 && !metersQuery.isLoading ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No meters yet</EmptyTitle>
                <EmptyDescription>
                  A meter matches events by type and aggregates a value from
                  them.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Aggregation</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>Value property</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-medium">
                      {row.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.aggregation}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.eventType}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.valueProperty ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={(props) => (
                            <Button variant="ghost" size="sm" {...props}>
                              Delete
                            </Button>
                          )}
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete &quot;{row.slug}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              The meter and its aggregation config are removed;
                              this cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => remove.mutate(row.id)}
                            >
                              Delete meter
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {meters.length > 0 && <QueryPanel teamId={teamId} meters={meters} />}
    </div>
  )
}

function QueryPanel({
  teamId,
  meters,
}: {
  teamId: string
  meters: { id: string; slug: string }[]
}) {
  const [meterId, setMeterId] = useState(meters[0]?.id ?? "")
  const [windowSize, setWindowSize] = useState<"hour" | "day" | "month">("day")
  const [subject, setSubject] = useState("")
  const [rows, setRows] = useState<
    { windowStart: string; subject: string | null; value: number }[] | null
  >(null)

  const run = useMutation({
    mutationFn: () => {
      const to = new Date()
      const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000)
      return meterClient.queryMeter({
        teamId,
        meterId,
        from: from.toISOString(),
        to: to.toISOString(),
        windowSize,
        subject: subject || undefined,
      })
    },
    onSuccess: (data) => setRows(data.rows),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query</CardTitle>
        <CardDescription>Aggregate the last 7 days.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={meterId} onValueChange={(v) => v && setMeterId(v)}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meters.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={windowSize}
            onValueChange={(v) => v && setWindowSize(v as typeof windowSize)}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["hour", "day", "month"] as const).map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-44"
            placeholder="subject (optional)"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <Button
            size="sm"
            disabled={run.isPending}
            onClick={() => run.mutate()}
          >
            Run
          </Button>
        </div>
        {rows &&
          (rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No data in range</EmptyTitle>
                <EmptyDescription>
                  No aggregated values for this meter in the last 7 days.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">
                      {row.windowStart}
                    </TableCell>
                    <TableCell>{row.subject ?? "all"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </CardContent>
    </Card>
  )
}

// ——— Events ———

function EventsTab({ teamId }: { teamId: string }) {
  const eventsQuery = useInfiniteQuery({
    queryKey: ["meter-events", teamId],
    queryFn: ({ pageParam }) =>
      meterClient.listEvents({
        teamId,
        limit: 50,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as { ts: number; id: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
  const events = eventsQuery.data?.pages.flatMap((page) => page.events) ?? []

  return (
    <Card>
      <CardContent>
        {events.length === 0 && !eventsQuery.isLoading ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No events yet</EmptyTitle>
              <EmptyDescription>
                Ingest with an API key scoped to this team:
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-left font-mono text-xs">
                {`curl -X POST ${window.location.origin}/api/meter/v1/events \\
  -H "x-api-key: oc_sk_..." -H "Content-Type: application/json" \\
  -d '{"id": "evt_1", "type": "llm.completion", "subject": "user-42", "data": {"tokens": 130, "model": "gpt-5"}}'`}
              </pre>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.storeRowId}>
                  <TableCell className="font-mono text-xs">
                    {event.type}
                  </TableCell>
                  <TableCell>{event.subject}</TableCell>
                  <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                    {event.data ? JSON.stringify(event.data) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {event.source}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(event.time).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {eventsQuery.hasNextPage ? (
          <div className="flex justify-center pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => eventsQuery.fetchNextPage()}
              disabled={eventsQuery.isFetchingNextPage}
            >
              {eventsQuery.isFetchingNextPage ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Load more
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ——— Grants ———

function GrantsPanel({
  teamId,
  entitlementId,
}: {
  teamId: string
  entitlementId: string
}) {
  const queryClient = useQueryClient()
  const grantsQuery = useQuery({
    queryKey: ["meter-grants", teamId, entitlementId],
    queryFn: () => meterClient.listGrants({ teamId, entitlementId }),
  })
  const grants = grantsQuery.data?.grants ?? []

  const [amount, setAmount] = useState("500")
  const [priority, setPriority] = useState("2")
  const [expiresDays, setExpiresDays] = useState("")

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["meter-grants", teamId, entitlementId],
    })

  const create = useMutation({
    mutationFn: () =>
      meterClient.createGrant({
        teamId,
        entitlementId,
        amount: Number(amount),
        priority: Number(priority) || 1,
        expiresIn: expiresDays
          ? { unit: "day", count: Number(expiresDays) }
          : undefined,
      }),
    onSuccess: invalidate,
  })

  const voidGrant = useMutation({
    mutationFn: (grantId: string) => meterClient.voidGrant({ teamId, grantId }),
    onSuccess: invalidate,
  })

  return (
    <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          className="h-8 w-28"
          type="number"
          placeholder="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Input
          className="h-8 w-24"
          type="number"
          placeholder="priority"
          title="1 burns first; the periodic allowance burns at 1"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        />
        <Input
          className="h-8 w-36"
          type="number"
          placeholder="expires (days)"
          value={expiresDays}
          onChange={(event) => setExpiresDays(event.target.value)}
        />
        <Button
          size="sm"
          disabled={create.isPending || !Number(amount)}
          onClick={() => create.mutate()}
        >
          Add grant
        </Button>
      </div>
      {grants.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.map((grant) => {
              const expired =
                grant.expiresAt && new Date(grant.expiresAt) < new Date()
              return (
                <TableRow key={grant.id}>
                  <TableCell className="font-mono">{grant.amount}</TableCell>
                  <TableCell>{grant.priority}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {grant.expiresAt
                      ? new Date(grant.expiresAt).toLocaleString()
                      : "never"}
                  </TableCell>
                  <TableCell>
                    {grant.voidedAt ? (
                      <Badge variant="destructive">voided</Badge>
                    ) : expired ? (
                      <Badge variant="secondary">expired</Badge>
                    ) : (
                      <Badge>active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!grant.voidedAt && !expired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => voidGrant.mutate(grant.id)}
                      >
                        Void
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ——— Features & Entitlements ———

function EntitlementsTab({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const featuresQuery = useQuery({
    queryKey: ["meter-features", teamId],
    queryFn: () => meterClient.listFeatures({ teamId }),
  })
  const metersQuery = useQuery({
    queryKey: ["meter-meters", teamId],
    queryFn: () => meterClient.listMeters({ teamId }),
  })
  const entitlementsQuery = useQuery({
    queryKey: ["meter-entitlements", teamId],
    queryFn: () => meterClient.listEntitlements({ teamId }),
  })
  const features = featuresQuery.data?.features ?? []
  const meters = metersQuery.data?.meters ?? []
  const entitlements = entitlementsQuery.data?.entitlements ?? []

  // Feature form
  const [featureKey, setFeatureKey] = useState("")
  const [featureName, setFeatureName] = useState("")
  const [featureMeterId, setFeatureMeterId] = useState<string>("")
  const createFeature = useMutation({
    mutationFn: () =>
      meterClient.createFeature({
        teamId,
        key: featureKey,
        name: featureName,
        meterId: featureMeterId || undefined,
      }),
    onSuccess: () => {
      setFeatureKey("")
      setFeatureName("")
      queryClient.invalidateQueries({ queryKey: ["meter-features", teamId] })
    },
  })

  // Entitlement form
  const [entFeatureId, setEntFeatureId] = useState("")
  const [entSubject, setEntSubject] = useState("")
  const [entLimit, setEntLimit] = useState("100")
  const createEntitlement = useMutation({
    mutationFn: () =>
      meterClient.createEntitlement({
        teamId,
        featureId: entFeatureId,
        subject: entSubject,
        type: "metered",
        limit: Number(entLimit),
        isSoftLimit: false,
        usagePeriod: "month",
        enabled: true,
      }),
    onSuccess: () => {
      setEntSubject("")
      queryClient.invalidateQueries({
        queryKey: ["meter-entitlements", teamId],
      })
    },
  })

  const [expandedGrants, setExpandedGrants] = useState<string | null>(null)

  const [checked, setChecked] = useState<
    Record<
      string,
      { hasAccess: boolean; usage: number | null; balance: number | null }
    >
  >({})
  const check = useMutation({
    mutationFn: (input: { id: string; featureKey: string; subject: string }) =>
      meterClient
        .entitlementValue({
          teamId,
          featureKey: input.featureKey,
          subject: input.subject,
        })
        .then((value) => ({ id: input.id, value })),
    onSuccess: ({ id, value }) =>
      setChecked((previous) => ({ ...previous, [id]: value })),
  })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            A named capability, optionally backed by a meter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="h-8 w-40"
              placeholder="key e.g. ai_tokens"
              value={featureKey}
              onChange={(event) => setFeatureKey(event.target.value)}
            />
            <Input
              className="h-8 w-40"
              placeholder="name"
              value={featureName}
              onChange={(event) => setFeatureName(event.target.value)}
            />
            <Select
              value={featureMeterId}
              onValueChange={(value) => setFeatureMeterId(value ?? "")}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="meter (optional)" />
              </SelectTrigger>
              <SelectContent>
                {meters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={createFeature.isPending || !featureKey || !featureName}
              onClick={() => createFeature.mutate()}
            >
              Add feature
            </Button>
          </div>
          {features.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Meter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((feature) => (
                  <TableRow key={feature.id}>
                    <TableCell className="font-mono font-medium">
                      {feature.key}
                    </TableCell>
                    <TableCell>{feature.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {feature.meterSlug ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entitlements</CardTitle>
          <CardDescription>
            Grant a subject access to a feature with a monthly limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={entFeatureId}
              onValueChange={(value) => setEntFeatureId(value ?? "")}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="feature" />
              </SelectTrigger>
              <SelectContent>
                {features.map((feature) => (
                  <SelectItem key={feature.id} value={feature.id}>
                    {feature.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 w-40"
              placeholder="subject e.g. user-42"
              value={entSubject}
              onChange={(event) => setEntSubject(event.target.value)}
            />
            <Input
              className="h-8 w-28"
              type="number"
              placeholder="limit"
              value={entLimit}
              onChange={(event) => setEntLimit(event.target.value)}
            />
            <Button
              size="sm"
              disabled={
                createEntitlement.isPending || !entFeatureId || !entSubject
              }
              onClick={() => createEntitlement.mutate()}
            >
              Grant
            </Button>
          </div>
          {entitlements.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Limit / period</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitlements.map((entitlement) => {
                  const current = checked[entitlement.id]
                  return (
                    <>
                      <TableRow key={entitlement.id}>
                        <TableCell className="font-mono font-medium">
                          {entitlement.featureKey}
                        </TableCell>
                        <TableCell>{entitlement.subject}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {entitlement.limit ?? "—"} / {entitlement.usagePeriod}
                        </TableCell>
                        <TableCell>
                          {current ? (
                            <span className="font-mono text-xs">
                              used {current.usage ?? 0}, left{" "}
                              {current.balance ?? 0}{" "}
                              {current.hasAccess ? (
                                <Badge>access</Badge>
                              ) : (
                                <Badge variant="destructive">blocked</Badge>
                              )}
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={check.isPending}
                              onClick={() =>
                                check.mutate({
                                  id: entitlement.id,
                                  featureKey: entitlement.featureKey,
                                  subject: entitlement.subject,
                                })
                              }
                            >
                              Check
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedGrants((previous) =>
                                previous === entitlement.id
                                  ? null
                                  : entitlement.id
                              )
                            }
                          >
                            Grants
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedGrants === entitlement.id && (
                        <TableRow key={`${entitlement.id}-grants`}>
                          <TableCell colSpan={5}>
                            <GrantsPanel
                              teamId={teamId}
                              entitlementId={entitlement.id}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
