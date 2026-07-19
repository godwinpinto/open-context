import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRoundIcon, PlusIcon } from "lucide-react"

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
import { Card, CardContent } from "@open-context/ui/components/card"
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
import { Spinner } from "@open-context/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@open-context/ui/components/table"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/o/$orgId/t/$teamId/manage/api-keys")({
  component: ApiKeysPage,
})

const KEYS_QUERY = ["team-api-keys"]

type KeyMetadata = { teamId?: string; environment?: string } | null

function ApiKeysPage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()

  const keysQuery = useQuery({
    queryKey: [...KEYS_QUERY, teamId],
    queryFn: async () => {
      const { data, error } = await authClient.apiKey.list()
      if (error) throw error
      // Keys are user-owned in better-auth; team scope lives in
      // metadata — show only this team's.
      return data.apiKeys.filter(
        (key) => (key.metadata as KeyMetadata)?.teamId === teamId,
      )
    },
  })
  const keys = keysQuery.data ?? []

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: KEYS_QUERY })

  const revoke = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await authClient.apiKey.delete({ keyId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateKeyDialog teamId={teamId} onCreated={invalidate} />
      </div>
      <Card>
        <CardContent>
          {keys.length === 0 && !keysQuery.isLoading ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRoundIcon />
                </EmptyMedia>
                <EmptyTitle>No API keys for this team yet</EmptyTitle>
                <EmptyDescription>
                  Keys authenticate SDKs, the CLI and CI against the consumer
                  APIs (Trail, Meter, Identity, Experiments, Flags).
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Rate limit</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => {
                  const metadata = key.metadata as KeyMetadata
                  // Keys created before the platform default was raised
                  // carry the plugin's unusable 10/day stamp.
                  const legacyLimit =
                    key.rateLimitEnabled && (key.rateLimitMax ?? 0) <= 10
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {key.start}…
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {metadata?.environment ?? "—"}
                      </TableCell>
                      <TableCell>
                        {key.rateLimitEnabled ? (
                          <span className="flex items-center gap-2 text-xs">
                            {key.rateLimitMax?.toLocaleString()}/day
                            {legacyLimit && (
                              <Badge variant="destructive">
                                legacy limit — recreate
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            unlimited
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {key.requestCount ?? 0}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {key.expiresAt
                          ? new Date(key.expiresAt).toLocaleDateString()
                          : "never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={<Button variant="ghost" size="sm" />}
                          >
                            Revoke
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Revoke {key.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Anything still using this key will stop
                                authenticating immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revoke.mutate(key.id)}
                              >
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
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

function CreateKeyDialog({
  teamId,
  onCreated,
}: {
  teamId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [environment, setEnvironment] = useState("")
  const [expiresDays, setExpiresDays] = useState("")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.apiKey.create({
        name,
        expiresIn: expiresDays ? Number(expiresDays) * 86400 : undefined,
        metadata: {
          teamId,
          ...(environment ? { environment } : {}),
        },
      })
      if (error) throw new Error(error.message ?? "Failed to create key")
      return data
    },
    onSuccess: (data) => {
      setCreatedKey(data.key)
      setError(null)
      onCreated()
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  function close(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setName("")
      setEnvironment("")
      setExpiresDays("")
      setCreatedKey(null)
      setCopied(false)
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        New API key
      </DialogTrigger>
      <DialogContent>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your key now</DialogTitle>
              <DialogDescription>
                This is the only time it will be shown — the platform stores
                only a hash.
              </DialogDescription>
            </DialogHeader>
            <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
              {createdKey}
            </pre>
            <DialogFooter>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey)
                  setCopied(true)
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Scoped to this team. Environment only affects the Flags
                module.
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
                  <FieldLabel htmlFor="key-name">Name</FieldLabel>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="production-backend"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="key-env">
                    Environment{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional — flags default to production)
                    </span>
                  </FieldLabel>
                  <Input
                    id="key-env"
                    value={environment}
                    onChange={(event) => setEnvironment(event.target.value)}
                    placeholder="production"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="key-expiry">
                    Expires in days{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional — never if blank)
                    </span>
                  </FieldLabel>
                  <Input
                    id="key-expiry"
                    type="number"
                    value={expiresDays}
                    onChange={(event) => setExpiresDays(event.target.value)}
                    placeholder="90"
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={create.isPending || !name}>
                  {create.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
