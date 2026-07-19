import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
import { experimentsClient } from "@/lib/modules/experiments-client"
import { segmentsClient } from "@/lib/modules/segments-client"

export default function ExperimentsPage({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const experimentsQuery = useQuery({
    queryKey: ["experiments", teamId],
    queryFn: () => experimentsClient.listExperiments({ teamId }),
  })
  const experiments = experimentsQuery.data?.experiments ?? []
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["experiments", teamId] })

  const setStatus = useMutation({
    mutationFn: (input: { experimentKey: string; action: "start" | "stop" }) =>
      experimentsClient.setStatus({ teamId, ...input }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (experimentKey: string) =>
      experimentsClient.deleteExperiment({ teamId, experimentKey }),
    onSuccess: () => {
      setSelectedKey(null)
      invalidate()
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <div>
          <h1 className="text-lg font-medium">Experiments</h1>
          <p className="text-sm text-muted-foreground">
            A/B test features with real statistics.
          </p>
        </div>
        <div className="ml-auto">
          <CreateExperimentDialog teamId={teamId} onCreated={invalidate} />
        </div>
      </div>

      <Card>
        <CardContent>
          {experiments.length === 0 && !experimentsQuery.isLoading ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No experiments yet</EmptyTitle>
                <EmptyDescription>
                  Create one, start it, then assign variants from your product
                  via
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">
                    POST /api/experiments/v1/assign
                  </code>
                  and report conversions via
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">
                    POST /api/experiments/v1/goal
                  </code>
                  .
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experiments.map((experiment) => (
                  <TableRow
                    key={experiment.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedKey(experiment.key)}
                  >
                    <TableCell className="font-mono font-medium">
                      {experiment.key}
                    </TableCell>
                    <TableCell>{experiment.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          experiment.status === "running"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {experiment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {experiment.variants
                        .map((variant) => `${variant.key}:${variant.weight}`)
                        .join(" / ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {experiment.segmentKey ?? "everyone"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {experiment.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            setStatus.mutate({
                              experimentKey: experiment.key,
                              action: "start",
                            })
                          }
                        >
                          Start
                        </Button>
                      )}
                      {experiment.status === "running" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setStatus.mutate({
                              experimentKey: experiment.key,
                              action: "stop",
                            })
                          }
                        >
                          Stop
                        </Button>
                      )}
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
                              Delete &quot;{experiment.key}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              The experiment and its assignments and results are
                              deleted; this cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => remove.mutate(experiment.key)}
                            >
                              Delete experiment
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

      {selectedKey && (
        <ResultsCard teamId={teamId} experimentKey={selectedKey} />
      )}
    </div>
  )
}

function CreateExperimentDialog({
  teamId,
  onCreated,
}: {
  teamId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState("")
  const [name, setName] = useState("")
  const [hypothesis, setHypothesis] = useState("")
  const [segmentKey, setSegmentKey] = useState("")
  const [variants, setVariants] = useState([
    { key: "control", weight: "50" },
    { key: "treatment", weight: "50" },
  ])
  const [error, setError] = useState<string | null>(null)

  const segmentsQuery = useQuery({
    queryKey: ["segments", teamId],
    queryFn: () => segmentsClient.listSegments({ teamId }),
    enabled: open,
  })
  const segments = segmentsQuery.data?.segments ?? []

  const create = useMutation({
    mutationFn: () =>
      experimentsClient.createExperiment({
        teamId,
        key,
        name,
        hypothesis: hypothesis || undefined,
        segmentKey: segmentKey || undefined,
        variants: variants
          .filter((variant) => variant.key)
          .map((variant) => ({
            key: variant.key,
            weight: Number(variant.weight) || 1,
          })),
      }),
    onSuccess: () => {
      setOpen(false)
      setKey("")
      setName("")
      setHypothesis("")
      setError(null)
      onCreated()
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button size="sm" {...props}>
            <PlusIcon data-icon="inline-start" />
            New experiment
          </Button>
        )}
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create experiment</DialogTitle>
          <DialogDescription>
            Define the variants and their relative weights; the experiment
            starts as a draft.
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
                <FieldLabel htmlFor="exp-key">Key</FieldLabel>
                <Input
                  id="exp-key"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="new_onboarding"
                  required
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="exp-name">Name</FieldLabel>
                <Input
                  id="exp-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="New onboarding flow"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="exp-hypothesis">
                Hypothesis (optional)
              </FieldLabel>
              <Input
                id="exp-hypothesis"
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                placeholder="The new flow increases signup completion"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="exp-segment">
                Target segment (optional)
              </FieldLabel>
              <Select
                value={segmentKey}
                onValueChange={(value) => setSegmentKey(value ?? "")}
              >
                <SelectTrigger id="exp-segment" className="w-full">
                  <SelectValue placeholder="everyone" />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment.key} value={segment.key}>
                      {segment.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>
                Variants{" "}
                <span className="font-normal text-muted-foreground">
                  (first is control; relative weights)
                </span>
              </FieldLabel>
              {variants.map((variant, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    className="h-8 flex-1"
                    placeholder="variant key"
                    value={variant.key}
                    onChange={(event) =>
                      setVariants((previous) =>
                        previous.map((v, i) =>
                          i === index ? { ...v, key: event.target.value } : v
                        )
                      )
                    }
                  />
                  <Input
                    className="h-8 w-24"
                    type="number"
                    placeholder="weight"
                    value={variant.weight}
                    onChange={(event) =>
                      setVariants((previous) =>
                        previous.map((v, i) =>
                          i === index ? { ...v, weight: event.target.value } : v
                        )
                      )
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setVariants((previous) => [
                    ...previous,
                    { key: "", weight: "50" },
                  ])
                }
              >
                Add variant
              </Button>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !key || !name}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResultsCard({
  teamId,
  experimentKey,
}: {
  teamId: string
  experimentKey: string
}) {
  const resultsQuery = useQuery({
    queryKey: ["experiment-results", teamId, experimentKey],
    queryFn: () => experimentsClient.results({ teamId, experimentKey }),
  })
  const results = resultsQuery.data
  if (!results) return null

  const formatPercent = (value: number | null, digits = 1) =>
    value == null ? "—" : `${(value * 100).toFixed(digits)}%`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="font-mono">{results.experiment.key}</CardTitle>
          <Badge
            variant={
              results.experiment.status === "running" ? "default" : "secondary"
            }
          >
            {results.experiment.status}
          </Badge>
          {results.srm.suspicious && (
            <Badge variant="destructive">
              SRM detected — results unreliable
            </Badge>
          )}
        </div>
        <CardDescription>
          Chance to beat control is Bayesian (Beta-Binomial); p-value is a
          two-proportion z-test.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Exposures</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Uplift</TableHead>
              <TableHead className="text-right">
                Chance to beat control
              </TableHead>
              <TableHead className="text-right">p-value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.variants.map((variant) => (
              <TableRow key={variant.key}>
                <TableCell className="font-mono font-medium">
                  {variant.key}
                  {variant.isControl && (
                    <Badge variant="secondary" className="ml-2">
                      control
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {variant.exposures}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {variant.conversions}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPercent(variant.rate)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {variant.relativeUplift == null
                    ? "—"
                    : `${variant.relativeUplift >= 0 ? "+" : ""}${formatPercent(variant.relativeUplift)}`}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPercent(variant.chanceToBeatControl)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {variant.pValue == null ? "—" : variant.pValue.toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
