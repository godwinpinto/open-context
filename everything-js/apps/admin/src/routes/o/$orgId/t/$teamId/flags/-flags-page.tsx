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
import { Field, FieldGroup, FieldLabel } from "@open-context/ui/components/field"
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
import { flagsClient } from "@/lib/modules/flags-client"
import { segmentsClient } from "@/lib/modules/segments-client"

export default function FlagsPage({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const environmentsQuery = useQuery({
    queryKey: ["flag-environments", teamId],
    queryFn: () => flagsClient.listEnvironments({ teamId }),
  })
  const environments = environmentsQuery.data?.environments ?? []
  const [environmentKey, setEnvironmentKey] = useState<string>("production")
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null)

  const flagsQuery = useQuery({
    queryKey: ["flags", teamId, environmentKey],
    queryFn: () => flagsClient.listFlags({ teamId, environmentKey }),
    enabled: environments.length > 0,
  })
  const flags = flagsQuery.data?.flags ?? []

  const invalidateFlags = () =>
    queryClient.invalidateQueries({ queryKey: ["flags", teamId] })

  const [newEnvKey, setNewEnvKey] = useState("")
  const createEnvironment = useMutation({
    mutationFn: () =>
      flagsClient.createEnvironment({
        teamId,
        key: newEnvKey,
        name: newEnvKey,
      }),
    onSuccess: (result) => {
      setNewEnvKey("")
      setEnvironmentKey(result.environment.key)
      queryClient.invalidateQueries({ queryKey: ["flag-environments", teamId] })
    },
  })

  const setState = useMutation({
    mutationFn: (input: { flagKey: string; enabled: boolean; value?: unknown }) =>
      flagsClient.setState({ teamId, environmentKey, ...input }),
    onSuccess: invalidateFlags,
  })
  const removeFlag = useMutation({
    mutationFn: (flagKey: string) => flagsClient.deleteFlag({ teamId, flagKey }),
    onSuccess: () => {
      setSelectedFlag(null)
      invalidateFlags()
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <div>
          <h1 className="text-lg font-medium">Flags</h1>
          <p className="text-muted-foreground text-sm">
            Feature flags with environments and targeting.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {environments.length > 0 && (
            <Select
              value={environmentKey}
              onValueChange={(value) => value && setEnvironmentKey(value)}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environments.map((environment) => (
                  <SelectItem key={environment.key} value={environment.key}>
                    {environment.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <CreateFlagDialog teamId={teamId} onCreated={invalidateFlags} />
        </div>
      </div>

      {environments.length === 0 && !environmentsQuery.isLoading ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              No environments yet. Create one to hold flag state — API keys
              select their environment via metadata
              (<code className="font-mono text-xs">{`{ "environment": "production" }`}</code>,
              defaults to production).
            </p>
            <div className="flex items-end gap-2">
              <Input
                className="h-8 w-48"
                placeholder="production"
                value={newEnvKey}
                onChange={(event) => setNewEnvKey(event.target.value)}
              />
              <Button
                size="sm"
                disabled={createEnvironment.isPending || !newEnvKey}
                onClick={() => createEnvironment.mutate()}
              >
                Create environment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            {flags.length === 0 && !flagsQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">
                No flags yet. Create one, then evaluate from your product via
                <code className="bg-muted mx-1 rounded px-1 font-mono text-xs">
                  POST /api/flags/v1/evaluate
                </code>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>State in {environmentKey}</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((definition) => (
                    <TableRow
                      key={definition.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedFlag(definition.key)}
                    >
                      <TableCell className="font-mono font-medium">
                        {definition.key}
                      </TableCell>
                      <TableCell>{definition.name}</TableCell>
                      <TableCell>
                        {definition.enabled ? (
                          <Badge>enabled</Badge>
                        ) : (
                          <Badge variant="secondary">disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-48 truncate font-mono text-xs">
                        {definition.value == null
                          ? "—"
                          : JSON.stringify(definition.value)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setState.mutate({
                              flagKey: definition.key,
                              enabled: !definition.enabled,
                              value: definition.value ?? undefined,
                            })
                          }
                        >
                          {definition.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFlag.mutate(definition.key)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex items-end gap-2 border-t pt-3">
              <Input
                className="h-8 w-48"
                placeholder="new environment key"
                value={newEnvKey}
                onChange={(event) => setNewEnvKey(event.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={createEnvironment.isPending || !newEnvKey}
                onClick={() => createEnvironment.mutate()}
              >
                Add environment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFlag && (
        <FlagDetail
          teamId={teamId}
          flagKey={selectedFlag}
          environmentKey={environmentKey}
        />
      )}

      {environments.length > 0 && (
        <TestPanel teamId={teamId} environmentKey={environmentKey} />
      )}
    </div>
  )
}

function CreateFlagDialog({
  teamId,
  onCreated,
}: {
  teamId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => flagsClient.createFlag({ teamId, key, name }),
    onSuccess: () => {
      setOpen(false)
      setKey("")
      setName("")
      setError(null)
      onCreated()
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>New flag</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create flag</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="flag-key">Key</FieldLabel>
              <Input
                id="flag-key"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="new_checkout"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="flag-name">Name</FieldLabel>
              <Input
                id="flag-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="New checkout flow"
                required
              />
            </Field>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Field>
              <Button type="submit" disabled={create.isPending || !key || !name}>
                Create
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FlagDetail({
  teamId,
  flagKey,
  environmentKey,
}: {
  teamId: string
  flagKey: string
  environmentKey: string
}) {
  const queryClient = useQueryClient()
  const overridesQuery = useQuery({
    queryKey: ["flag-overrides", teamId, flagKey, environmentKey],
    queryFn: () => flagsClient.listOverrides({ teamId, flagKey, environmentKey }),
  })
  const segmentsQuery = useQuery({
    queryKey: ["segments", teamId],
    queryFn: () => segmentsClient.listSegments({ teamId }),
  })
  const overrides = overridesQuery.data
  const segments = segmentsQuery.data?.segments ?? []

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["flag-overrides", teamId, flagKey, environmentKey],
    })

  const [segKey, setSegKey] = useState("")
  const [segEnabled, setSegEnabled] = useState("enabled")
  const [segValue, setSegValue] = useState("")
  const addSegment = useMutation({
    mutationFn: () =>
      flagsClient.setSegmentOverride({
        teamId,
        flagKey,
        environmentKey,
        segmentKey: segKey,
        priority: 1,
        enabled: segEnabled === "enabled",
        value: segValue || undefined,
      }),
    onSuccess: invalidate,
  })
  const removeSegment = useMutation({
    mutationFn: (segmentKey: string) =>
      flagsClient.removeSegmentOverride({
        teamId,
        flagKey,
        environmentKey,
        segmentKey,
      }),
    onSuccess: invalidate,
  })

  const [idKey, setIdKey] = useState("")
  const [idEnabled, setIdEnabled] = useState("enabled")
  const addIdentity = useMutation({
    mutationFn: () =>
      flagsClient.setIdentityOverride({
        teamId,
        flagKey,
        environmentKey,
        identityKey: idKey,
        enabled: idEnabled === "enabled",
      }),
    onSuccess: invalidate,
  })
  const removeIdentity = useMutation({
    mutationFn: (identityKey: string) =>
      flagsClient.removeIdentityOverride({
        teamId,
        flagKey,
        environmentKey,
        identityKey,
      }),
    onSuccess: invalidate,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono">
          {flagKey}{" "}
          <span className="text-muted-foreground text-sm font-normal">
            overrides in {environmentKey}
          </span>
        </CardTitle>
        <CardDescription>
          Precedence: identity override → segment overrides → environment
          default.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Segment overrides</p>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={segKey} onValueChange={(v) => setSegKey(v ?? "")}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="segment" />
              </SelectTrigger>
              <SelectContent>
                {segments.map((segment) => (
                  <SelectItem key={segment.key} value={segment.key}>
                    {segment.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={segEnabled}
              onValueChange={(v) => v && setSegEnabled(v)}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">enabled</SelectItem>
                <SelectItem value="disabled">disabled</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 w-40"
              placeholder="value (optional)"
              value={segValue}
              onChange={(event) => setSegValue(event.target.value)}
            />
            <Button
              size="sm"
              disabled={addSegment.isPending || !segKey}
              onClick={() => addSegment.mutate()}
            >
              Set
            </Button>
          </div>
          {(overrides?.segments ?? []).map((override) => (
            <div
              key={override.id}
              className="text-muted-foreground flex items-center gap-2 font-mono text-xs"
            >
              <Badge variant={override.enabled ? "default" : "destructive"}>
                {override.enabled ? "on" : "off"}
              </Badge>
              {override.segmentKey}
              {override.value != null && ` → ${JSON.stringify(override.value)}`}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSegment.mutate(override.segmentKey)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Identity overrides</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="h-8 w-44"
              placeholder="identity key e.g. user-7"
              value={idKey}
              onChange={(event) => setIdKey(event.target.value)}
            />
            <Select
              value={idEnabled}
              onValueChange={(v) => v && setIdEnabled(v)}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">enabled</SelectItem>
                <SelectItem value="disabled">disabled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={addIdentity.isPending || !idKey}
              onClick={() => addIdentity.mutate()}
            >
              Set
            </Button>
          </div>
          {(overrides?.identities ?? []).map((override) => (
            <div
              key={override.id}
              className="text-muted-foreground flex items-center gap-2 font-mono text-xs"
            >
              <Badge variant={override.enabled ? "default" : "destructive"}>
                {override.enabled ? "on" : "off"}
              </Badge>
              {override.identityKey}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeIdentity.mutate(override.identityKey)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TestPanel({
  teamId,
  environmentKey,
}: {
  teamId: string
  environmentKey: string
}) {
  const [identityKey, setIdentityKey] = useState("")
  const [result, setResult] = useState<Record<
    string,
    { enabled: boolean; value: unknown; source: string }
  > | null>(null)
  const test = useMutation({
    mutationFn: () =>
      flagsClient.testEvaluate({ teamId, environmentKey, identityKey }),
    onSuccess: (data) => setResult(data.flags),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test evaluation</CardTitle>
        <CardDescription>
          Evaluate all flags in {environmentKey} for an identity, with the
          deciding source per flag.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Input
            className="h-8 w-56"
            placeholder="identity key e.g. user-42"
            value={identityKey}
            onChange={(event) => setIdentityKey(event.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={test.isPending || !identityKey}
            onClick={() => test.mutate()}
          >
            Evaluate
          </Button>
        </div>
        {result && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(result).map(([key, flagResult]) => (
                <TableRow key={key}>
                  <TableCell className="font-mono font-medium">{key}</TableCell>
                  <TableCell>
                    {flagResult.enabled ? (
                      <Badge>on</Badge>
                    ) : (
                      <Badge variant="secondary">off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate font-mono text-xs">
                    {flagResult.value == null
                      ? "—"
                      : JSON.stringify(flagResult.value)}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {flagResult.source}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
