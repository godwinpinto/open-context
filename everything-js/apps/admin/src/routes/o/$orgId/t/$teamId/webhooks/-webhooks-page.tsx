import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, WebhookIcon } from "lucide-react"

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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import { webhooksClient } from "@/lib/modules/webhooks-client"

export default function WebhooksPage({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const endpointsQuery = useQuery({
    queryKey: ["webhook-endpoints", teamId],
    queryFn: () => webhooksClient.listEndpoints({ teamId }),
  })
  const messagesQuery = useQuery({
    queryKey: ["webhook-messages", teamId],
    queryFn: () => webhooksClient.listMessages({ teamId, limit: 50 }),
  })
  const endpoints = endpointsQuery.data?.endpoints ?? []
  const messages = messagesQuery.data?.messages ?? []
  const attempts = messagesQuery.data?.attempts ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["webhook-endpoints", teamId] })
    queryClient.invalidateQueries({ queryKey: ["webhook-messages", teamId] })
  }

  // ——— Create endpoint ———
  const [createOpen, setCreateOpen] = useState(false)
  const [ownerType, setOwnerType] = useState<"team" | "identity" | "group">(
    "identity",
  )
  const [ownerKey, setOwnerKey] = useState("")
  const [url, setUrl] = useState("")
  const [eventTypesCsv, setEventTypesCsv] = useState("")
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const createEndpoint = useMutation({
    mutationFn: () =>
      webhooksClient.createEndpoint({
        teamId,
        ownerType,
        ...(ownerType === "team" ? {} : { ownerKey }),
        url,
        ...(eventTypesCsv.trim()
          ? {
              eventTypes: eventTypesCsv
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean),
            }
          : {}),
      }),
    onSuccess: (result) => {
      setCreatedSecret(result.endpoint.secret)
      setUrl("")
      setOwnerKey("")
      setEventTypesCsv("")
      invalidate()
    },
  })

  const setDisabled = useMutation({
    mutationFn: (input: { id: string; disabled: boolean }) =>
      webhooksClient.setEndpointDisabled({ teamId, ...input }),
    onSuccess: invalidate,
  })
  const deleteEndpoint = useMutation({
    mutationFn: (id: string) => webhooksClient.deleteEndpoint({ teamId, id }),
    onSuccess: invalidate,
  })
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null)
  const rotateSecret = useMutation({
    mutationFn: (id: string) => webhooksClient.rotateSecret({ teamId, id }),
    onSuccess: (result) => setRotatedSecret(result.secret),
  })
  const deliverNow = useMutation({
    mutationFn: () => webhooksClient.deliverNow({ teamId }),
    onSuccess: invalidate,
  })
  const replay = useMutation({
    mutationFn: (input: { messageId: string; endpointId: string }) =>
      webhooksClient.replay({ teamId, ...input }),
    onSuccess: invalidate,
  })

  const endpointById = new Map(
    endpoints.map((endpoint) => [endpoint.id, endpoint]),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Webhooks</h1>
          <p className="text-muted-foreground text-sm">
            Signed deliveries (Standard Webhooks) to your customers&apos;
            endpoints. Retries are swept on API traffic or manually — no cron.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => deliverNow.mutate()}
            disabled={deliverNow.isPending}
          >
            {deliverNow.isPending ? <Spinner data-icon="inline-start" /> : null}
            Deliver due now
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={(props) => (
                <Button {...props}>
                  <PlusIcon data-icon="inline-start" />
                  Add endpoint
                </Button>
              )}
            />
            <DialogContent>
              {createdSecret ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Endpoint created</DialogTitle>
                    <DialogDescription>
                      Its signing secret is shown below — retrievable later from
                      this table&apos;s Rotate action.
                    </DialogDescription>
                  </DialogHeader>
                  <code className="bg-muted block break-all rounded-md p-2 font-mono text-xs">
                    {createdSecret}
                  </code>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setCreatedSecret(null)
                        setCreateOpen(false)
                      }}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Add webhook endpoint</DialogTitle>
                    <DialogDescription>
                      Deliveries to this URL are signed with a per-endpoint
                      secret.
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="webhook-owner-type">Owner</FieldLabel>
                      <Select
                        value={ownerType}
                        onValueChange={(value) =>
                          setOwnerType(value as typeof ownerType)
                        }
                      >
                        <SelectTrigger id="webhook-owner-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="identity">
                            Identity (a customer)
                          </SelectItem>
                          <SelectItem value="group">Group</SelectItem>
                          <SelectItem value="team">
                            Team (platform notifications)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {ownerType !== "team" ? (
                      <Field>
                        <FieldLabel htmlFor="webhook-owner-key">
                          {ownerType === "identity"
                            ? "Identity key"
                            : "Group key"}
                        </FieldLabel>
                        <Input
                          id="webhook-owner-key"
                          value={ownerKey}
                          onChange={(event) => setOwnerKey(event.target.value)}
                          placeholder="user-42"
                        />
                      </Field>
                    ) : null}
                    <Field>
                      <FieldLabel htmlFor="webhook-url">URL</FieldLabel>
                      <Input
                        id="webhook-url"
                        type="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com/webhooks"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="webhook-event-types">
                        Event types (optional, comma-separated)
                      </FieldLabel>
                      <Input
                        id="webhook-event-types"
                        value={eventTypesCsv}
                        onChange={(event) =>
                          setEventTypesCsv(event.target.value)
                        }
                        placeholder="invoice.paid, user.created"
                      />
                    </Field>
                    {createEndpoint.error ? (
                      <FieldError>{createEndpoint.error.message}</FieldError>
                    ) : null}
                  </FieldGroup>
                  <DialogFooter>
                    <Button
                      onClick={() => createEndpoint.mutate()}
                      disabled={
                        createEndpoint.isPending ||
                        !url ||
                        (ownerType !== "team" && !ownerKey)
                      }
                    >
                      {createEndpoint.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : null}
                      Create
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            Auto-disabled after 5 consecutive undeliverable messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rotatedSecret ? (
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-sm font-medium">New signing secret:</p>
              <code className="bg-muted block break-all rounded-md p-2 font-mono text-xs">
                {rotatedSecret}
              </code>
            </div>
          ) : null}
          {endpoints.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WebhookIcon />
                </EmptyMedia>
                <EmptyTitle>No endpoints yet</EmptyTitle>
                <EmptyDescription>
                  Add an endpoint to start receiving signed deliveries.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((endpoint) => (
                  <TableRow key={endpoint.id}>
                    <TableCell className="font-mono text-xs">
                      {endpoint.ownerType === "team"
                        ? "team"
                        : `${endpoint.ownerType}:${endpoint.ownerKey}`}
                    </TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs">
                      {endpoint.url}
                    </TableCell>
                    <TableCell className="text-xs">
                      {endpoint.eventTypes?.join(", ") ?? "all"}
                    </TableCell>
                    <TableCell>
                      {endpoint.disabled ? (
                        <Badge
                          variant="destructive"
                          title={endpoint.disabledReason ?? undefined}
                        >
                          Disabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDisabled.mutate({
                              id: endpoint.id,
                              disabled: !endpoint.disabled,
                            })
                          }
                        >
                          {endpoint.disabled ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rotateSecret.mutate(endpoint.id)}
                        >
                          Rotate
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={(props) => (
                              <Button
                                size="sm"
                                variant="destructive"
                                {...props}
                              >
                                Delete
                              </Button>
                            )}
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete this endpoint?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Pending deliveries to it are cancelled and its
                                signing secret is destroyed. This cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteEndpoint.mutate(endpoint.id)
                                }
                              >
                                Delete endpoint
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
          <CardTitle>Recent deliveries</CardTitle>
          <CardDescription>
            Latest 50 messages and their per-endpoint attempts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No messages yet</EmptyTitle>
                <EmptyDescription>
                  Deliveries show up here as soon as events are published.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Tries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.flatMap((message) => {
                  const messageAttempts = attempts.filter(
                    (attempt) => attempt.messageId === message.id,
                  )
                  if (messageAttempts.length === 0) {
                    return (
                      <TableRow key={message.id}>
                        <TableCell className="font-mono text-xs">
                          {message.eventType}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {message.ownerType === "team"
                            ? "team"
                            : `${message.ownerType}:${message.ownerKey}`}
                        </TableCell>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground text-xs"
                        >
                          No matching endpoints at publish time.
                        </TableCell>
                      </TableRow>
                    )
                  }
                  return messageAttempts.map((attempt) => {
                    const endpoint = endpointById.get(attempt.endpointId)
                    return (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-mono text-xs">
                          {message.eventType}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {message.ownerType === "team"
                            ? "team"
                            : `${message.ownerType}:${message.ownerKey}`}
                        </TableCell>
                        <TableCell className="max-w-48 truncate font-mono text-xs">
                          {endpoint?.url ?? attempt.endpointId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              attempt.status === "success"
                                ? "secondary"
                                : attempt.status === "pending"
                                  ? "outline"
                                  : "destructive"
                            }
                            title={attempt.responseSnippet ?? undefined}
                          >
                            {attempt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {attempt.httpStatus ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {attempt.attemptNumber}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              replay.mutate({
                                messageId: message.id,
                                endpointId: attempt.endpointId,
                              })
                            }
                          >
                            Replay
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
