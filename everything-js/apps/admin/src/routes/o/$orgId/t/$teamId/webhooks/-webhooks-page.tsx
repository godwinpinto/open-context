import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@open-context/ui/components/dialog"
import {
  Field,
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
      <div className="flex items-center justify-between">
        <div>
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
            {deliverNow.isPending ? "Delivering…" : "Deliver due now"}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={(props) => <Button {...props}>Add endpoint</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add webhook endpoint</DialogTitle>
              </DialogHeader>
              {createdSecret ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Endpoint created. Its signing secret (retrievable later
                    from this table&apos;s Rotate action):
                  </p>
                  <code className="bg-muted block break-all rounded p-2 text-xs">
                    {createdSecret}
                  </code>
                  <Button
                    onClick={() => {
                      setCreatedSecret(null)
                      setCreateOpen(false)
                    }}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Owner</FieldLabel>
                    <Select
                      value={ownerType}
                      onValueChange={(value) =>
                        setOwnerType(value as typeof ownerType)
                      }
                    >
                      <SelectTrigger>
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
                      <FieldLabel>
                        {ownerType === "identity" ? "Identity key" : "Group key"}
                      </FieldLabel>
                      <Input
                        value={ownerKey}
                        onChange={(event) => setOwnerKey(event.target.value)}
                        placeholder="user-42"
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel>URL</FieldLabel>
                    <Input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://example.com/webhooks"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Event types (optional, comma-separated)</FieldLabel>
                    <Input
                      value={eventTypesCsv}
                      onChange={(event) => setEventTypesCsv(event.target.value)}
                      placeholder="invoice.paid, user.created"
                    />
                  </Field>
                  <Button
                    onClick={() => createEndpoint.mutate()}
                    disabled={
                      createEndpoint.isPending ||
                      !url ||
                      (ownerType !== "team" && !ownerKey)
                    }
                  >
                    {createEndpoint.isPending ? "Creating…" : "Create"}
                  </Button>
                  {createEndpoint.error ? (
                    <p className="text-destructive text-sm">
                      {createEndpoint.error.message}
                    </p>
                  ) : null}
                </FieldGroup>
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
            <div className="mb-4 space-y-1">
              <p className="text-sm font-medium">New signing secret:</p>
              <code className="bg-muted block break-all rounded p-2 text-xs">
                {rotatedSecret}
              </code>
            </div>
          ) : null}
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
              {endpoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No endpoints yet.
                  </TableCell>
                </TableRow>
              ) : (
                endpoints.map((endpoint) => (
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
                    <TableCell className="space-x-1 text-right">
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
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteEndpoint.mutate(endpoint.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
              {messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No messages yet.
                  </TableCell>
                </TableRow>
              ) : (
                messages.flatMap((message) => {
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
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
