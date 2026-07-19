import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, UsersIcon } from "lucide-react"

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
import { segmentsClient } from "@/lib/modules/segments-client"

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "regex",
  "is_set",
  "is_not_set",
] as const

function regexError(pattern: string): string | null {
  if (!pattern) return null
  if (pattern.length > 200) return "Pattern too long (max 200 chars)"
  try {
    new RegExp(pattern)
    return null
  } catch {
    return "Invalid regular expression"
  }
}

type Operator = (typeof OPERATORS)[number]

type ConditionDraft = {
  property: string
  operator: Operator
  value: string
}

export default function SegmentsPage({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const segmentsQuery = useQuery({
    queryKey: ["segments", teamId],
    queryFn: () => segmentsClient.listSegments({ teamId }),
  })
  const segments = segmentsQuery.data?.segments ?? []
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = segments.find((s) => s.key === selectedKey) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <div>
          <h1 className="text-lg font-medium">Segmentation</h1>
          <p className="text-muted-foreground text-sm">
            Named sets of identities — rule-based or hand-picked — usable as
            filters everywhere.
          </p>
        </div>
        <div className="ml-auto">
          <CreateSegmentDialog
            teamId={teamId}
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: ["segments", teamId] })
            }
          />
        </div>
      </div>

      <Card>
        <CardContent>
          {segments.length === 0 && !segmentsQuery.isLoading ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>No segments yet</EmptyTitle>
                <EmptyDescription>
                  Create a dynamic segment from identity properties, or a
                  manual one from a list of identity keys.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Definition</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => (
                  <TableRow
                    key={segment.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedKey(segment.key)}
                  >
                    <TableCell className="font-mono font-medium">
                      {segment.key}
                    </TableCell>
                    <TableCell>{segment.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          segment.type === "dynamic" ? "default" : "secondary"
                        }
                      >
                        {segment.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-72 truncate font-mono text-xs">
                      {segment.rules
                        ? `${segment.rules.match}: ` +
                          segment.rules.conditions
                            .map((c) =>
                              c.type === "split"
                                ? `${c.percentage}% split`
                                : `${c.property} ${c.operator} ${c.value ?? ""}`,
                            )
                            .join(", ")
                        : "manual list"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DeleteButton
                        teamId={teamId}
                        segmentKey={segment.key}
                        onDeleted={() => {
                          setSelectedKey(null)
                          queryClient.invalidateQueries({
                            queryKey: ["segments", teamId],
                          })
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <SegmentDetail
          teamId={teamId}
          segmentKey={selected.key}
          type={selected.type as "dynamic" | "manual"}
        />
      )}
    </div>
  )
}

function DeleteButton({
  teamId,
  segmentKey,
  onDeleted,
}: {
  teamId: string
  segmentKey: string
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => segmentsClient.deleteSegment({ teamId, segmentKey }),
    onSuccess: onDeleted,
  })
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {segmentKey}?</AlertDialogTitle>
          <AlertDialogDescription>
            The segment and its membership are removed, and anything filtering
            by it stops matching.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CreateSegmentDialog({
  teamId,
  onCreated,
}: {
  teamId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<"dynamic" | "manual">("dynamic")
  const [match, setMatch] = useState<"all" | "any">("all")
  const [conditions, setConditions] = useState<ConditionDraft[]>([
    { property: "", operator: "equals", value: "" },
  ])
  const [splitPct, setSplitPct] = useState("")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => {
      const ruleConditions = [
        ...conditions
          .filter((c) => c.property)
          .map((c) => ({
            type: "property" as const,
            property: c.property,
            operator: c.operator,
            value:
              c.operator === "is_set" || c.operator === "is_not_set"
                ? undefined
                : c.operator === "in"
                  ? c.value
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                  : c.value,
          })),
        ...(splitPct
          ? [{ type: "split" as const, percentage: Number(splitPct) }]
          : []),
      ]
      return segmentsClient.createSegment({
        teamId,
        key,
        name,
        type,
        rules:
          type === "dynamic" ? { match, conditions: ruleConditions } : undefined,
      })
    },
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
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        New segment
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create segment</DialogTitle>
          <DialogDescription>
            Dynamic segments match rules over identity properties; manual
            segments are hand-picked lists.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <FieldGroup>
            <div className="flex gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="seg-key">Key</FieldLabel>
                <Input
                  id="seg-key"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="power_users"
                  required
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="seg-name">Name</FieldLabel>
                <Input
                  id="seg-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Power users"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                value={type}
                onValueChange={(value) =>
                  value && setType(value as "dynamic" | "manual")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">
                    dynamic — rules over identity properties
                  </SelectItem>
                  <SelectItem value="manual">
                    manual — hand-picked identity list
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {type === "dynamic" && (
              <>
                <Field>
                  <FieldLabel>Match</FieldLabel>
                  <Select
                    value={match}
                    onValueChange={(value) =>
                      value && setMatch(value as "all" | "any")
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">all</SelectItem>
                      <SelectItem value="any">any</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <Input
                      className="h-8 flex-1"
                      placeholder="property e.g. plan"
                      value={condition.property}
                      onChange={(event) =>
                        setConditions((previous) =>
                          previous.map((c, i) =>
                            i === index
                              ? { ...c, property: event.target.value }
                              : c,
                          ),
                        )
                      }
                    />
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        value &&
                        setConditions((previous) =>
                          previous.map((c, i) =>
                            i === index
                              ? { ...c, operator: value as Operator }
                              : c,
                          ),
                        )
                      }
                    >
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {condition.operator !== "is_set" &&
                      condition.operator !== "is_not_set" && (
                        <div className="flex flex-1 flex-col gap-1">
                          <Input
                            className="h-8"
                            placeholder={
                              condition.operator === "in"
                                ? "values, comma-separated"
                                : condition.operator === "regex"
                                  ? "pattern e.g. ^pro"
                                  : "value"
                            }
                            aria-invalid={
                              condition.operator === "regex" &&
                              !!regexError(condition.value)
                            }
                            value={condition.value}
                            onChange={(event) =>
                              setConditions((previous) =>
                                previous.map((c, i) =>
                                  i === index
                                    ? { ...c, value: event.target.value }
                                    : c,
                                ),
                              )
                            }
                          />
                          {condition.operator === "regex" &&
                            regexError(condition.value) && (
                              <FieldError>
                                {regexError(condition.value)}
                              </FieldError>
                            )}
                        </div>
                      )}
                  </div>
                ))}
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setConditions((previous) => [
                        ...previous,
                        { property: "", operator: "equals", value: "" },
                      ])
                    }
                  >
                    Add condition
                  </Button>
                  <Input
                    className="h-8 w-40"
                    type="number"
                    placeholder="% split (optional)"
                    value={splitPct}
                    onChange={(event) => setSplitPct(event.target.value)}
                  />
                </div>
              </>
            )}

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                create.isPending ||
                !key ||
                !name ||
                conditions.some(
                  (c) => c.operator === "regex" && !!regexError(c.value),
                )
              }
            >
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SegmentDetail({
  teamId,
  segmentKey,
  type,
}: {
  teamId: string
  segmentKey: string
  type: "dynamic" | "manual"
}) {
  const queryClient = useQueryClient()
  const membersQuery = useQuery({
    queryKey: ["segment-members", teamId, segmentKey],
    queryFn: () => segmentsClient.listMembers({ teamId, segmentKey }),
  })
  const members = membersQuery.data?.members ?? []

  const [newMembers, setNewMembers] = useState("")
  const addMembers = useMutation({
    mutationFn: () =>
      segmentsClient.addManualMembers({
        teamId,
        segmentKey,
        members: newMembers
          .split(/[\s,]+/)
          .map((m) => m.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setNewMembers("")
      queryClient.invalidateQueries({
        queryKey: ["segment-members", teamId, segmentKey],
      })
    },
  })

  const [testKey, setTestKey] = useState("")
  const [testResult, setTestResult] = useState<{
    matched: boolean
    conditions: { condition: unknown; passed: boolean }[]
  } | null>(null)
  const test = useMutation({
    mutationFn: () =>
      segmentsClient.testIdentity({ teamId, segmentKey, identityKey: testKey }),
    onSuccess: (result) => setTestResult(result),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono">{segmentKey}</CardTitle>
        <CardDescription>
          {type === "manual"
            ? "Hand-picked members — add identity keys or UUIDs."
            : "Members matching the rules right now."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {type === "manual" && (
          <div className="flex items-end gap-2">
            <Input
              className="h-8 flex-1"
              placeholder="user-42, user-7 or UUIDs (comma/space separated)"
              value={newMembers}
              onChange={(event) => setNewMembers(event.target.value)}
            />
            <Button
              size="sm"
              disabled={addMembers.isPending || !newMembers.trim()}
              onClick={() => addMembers.mutate()}
            >
              Add members
            </Button>
          </div>
        )}

        {members.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No members</EmptyTitle>
              <EmptyDescription>
                {type === "manual"
                  ? "Add identity keys above to populate this segment."
                  : "No identities match the rules right now."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Properties</TableHead>
                {type === "manual" && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.key}>
                  <TableCell className="font-mono font-medium">
                    {member.key}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-72 truncate font-mono text-xs">
                    {JSON.stringify(member.properties)}
                  </TableCell>
                  {type === "manual" && (
                    <TableCell className="text-right">
                      <RemoveMemberButton
                        teamId={teamId}
                        segmentKey={segmentKey}
                        member={member.key}
                        onRemoved={() =>
                          queryClient.invalidateQueries({
                            queryKey: ["segment-members", teamId, segmentKey],
                          })
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm font-medium">Test an identity</p>
          <div className="flex items-end gap-2">
            <Input
              className="h-8 w-56"
              placeholder="identity key e.g. user-42"
              value={testKey}
              onChange={(event) => setTestKey(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={test.isPending || !testKey}
              onClick={() => test.mutate()}
            >
              Test
            </Button>
            {testResult && (
              <span className="pb-1">
                {testResult.matched ? (
                  <Badge>in segment</Badge>
                ) : (
                  <Badge variant="destructive">not in segment</Badge>
                )}
              </span>
            )}
          </div>
          {testResult && testResult.conditions.length > 0 && (
            <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
              {testResult.conditions
                .map(
                  (entry) =>
                    `${entry.passed ? "✓" : "✗"} ${JSON.stringify(entry.condition)}`,
                )
                .join("\n")}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RemoveMemberButton({
  teamId,
  segmentKey,
  member,
  onRemoved,
}: {
  teamId: string
  segmentKey: string
  member: string
  onRemoved: () => void
}) {
  const remove = useMutation({
    mutationFn: () =>
      segmentsClient.removeManualMember({ teamId, segmentKey, member }),
    onSuccess: onRemoved,
  })
  return (
    <Button variant="ghost" size="sm" onClick={() => remove.mutate()}>
      Remove
    </Button>
  )
}
