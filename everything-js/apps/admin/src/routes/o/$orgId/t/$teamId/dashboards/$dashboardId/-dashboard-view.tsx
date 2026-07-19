import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import GridLayout, { useContainerWidth  } from "react-grid-layout"
import type {Layout} from "react-grid-layout";
import { CheckIcon, MoreHorizontalIcon, PencilIcon, XIcon } from "lucide-react"

import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

import type { ChartType, PanelConfig } from "@open-context/module-dashboards"

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@open-context/ui/components/dropdown-menu"
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
  FieldDescription,
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
import { Skeleton } from "@open-context/ui/components/skeleton"
import { cn } from "@open-context/ui/lib/utils"
import { PanelChart } from "@/components/panel-chart"
import { TimeRangePicker  } from "@/components/time-range-picker"
import type {TimeRange} from "@/components/time-range-picker";
import { dashboardsClient, rangeForKey } from "@/lib/modules/dashboards-client"

type PanelMeta = {
  id: string
  title: string
  description: string | null
  chartType: ChartType
  config: PanelConfig
}

export default function DashboardView({
  teamId,
  dashboardId,
}: {
  teamId: string
  dashboardId: string
}) {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<TimeRange>(() => rangeForKey("7d"))
  // Layout is read-only until the user explicitly enters edit mode —
  // no accidental drags while reading charts. Edits buffer locally in
  // pendingLayout and hit the server only on "Save layout"; Cancel
  // discards.
  const [editMode, setEditMode] = useState(false)
  const [pendingLayout, setPendingLayout] = useState<Layout | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", teamId, dashboardId],
    queryFn: () => dashboardsClient.getDashboard({ teamId, id: dashboardId }),
  })
  const dashboard = dashboardQuery.data?.dashboard
  const panels: PanelMeta[] = dashboardQuery.data?.panels ?? []
  const shares = dashboardQuery.data?.shares ?? []

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard", teamId, dashboardId] })

  const saveLayout = useMutation({
    mutationFn: (layout: Layout) =>
      dashboardsClient.saveLayout({
        teamId,
        id: dashboardId,
        layout: layout.map((item) => ({
          panelId: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
      }),
  })
  const deletePanel = useMutation({
    mutationFn: (id: string) => dashboardsClient.deletePanel({ teamId, id }),
    onSuccess: invalidate,
  })
  const updatePanel = useMutation({
    mutationFn: (input: { id: string; title: string; description: string }) =>
      dashboardsClient.updatePanel({ teamId, ...input }),
    onSuccess: invalidate,
  })

  // ——— Shares ———
  const [expiresInDays, setExpiresInDays] = useState<string>("7")
  const createShare = useMutation({
    mutationFn: () =>
      dashboardsClient.createShare({
        teamId,
        dashboardId,
        ...(expiresInDays === "never"
          ? {}
          : { expiresInDays: Number(expiresInDays) }),
      }),
    onSuccess: invalidate,
  })
  const setShareDisabled = useMutation({
    mutationFn: (input: { id: string; disabled: boolean }) =>
      dashboardsClient.setShareDisabled({ teamId, ...input }),
    onSuccess: invalidate,
  })
  const deleteShare = useMutation({
    mutationFn: (id: string) => dashboardsClient.deleteShare({ teamId, id }),
    onSuccess: invalidate,
  })

  const { width, containerRef } = useContainerWidth()

  if (!dashboard) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const persistedLayout: Layout = dashboard.layout.map((item) => ({
    i: item.panelId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }))
  const layout = (editMode && pendingLayout) || persistedLayout

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{dashboard.name}</h1>
          {dashboard.groupName ? (
            <Badge variant="outline">{dashboard.groupName}</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editMode ? (
            <>
              <Button
                onClick={() => {
                  if (pendingLayout) saveLayout.mutate(pendingLayout)
                  setPendingLayout(null)
                  setEditMode(false)
                }}
              >
                Save layout
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPendingLayout(null)
                  setEditMode(false)
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(props) => (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Dashboard actions"
                    {...props}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setEditMode(true)}>
                    Edit layout
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareOpen(true)}>
                    Share…
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share dashboard</DialogTitle>
                <DialogDescription>
                  Anyone with a link sees a read-only copy of this dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Select
                    value={expiresInDays}
                    onValueChange={(value) => value && setExpiresInDays(value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Expires in 1 day</SelectItem>
                      <SelectItem value="7">Expires in 7 days</SelectItem>
                      <SelectItem value="30">Expires in 30 days</SelectItem>
                      <SelectItem value="never">No expiry</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => createShare.mutate()}
                    disabled={createShare.isPending}
                  >
                    Create link
                  </Button>
                </div>
                {shares.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No links yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {shares.map((share) => (
                      <ShareRow
                        key={share.id}
                        share={share}
                        onToggleDisabled={() =>
                          setShareDisabled.mutate({
                            id: share.id,
                            disabled: !share.disabled,
                          })
                        }
                        onDelete={() => deleteShare.mutate(share.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <TimeRangePicker value={range} onChange={setRange} />

      {editMode ? (
        <p className="text-muted-foreground text-xs">
          Drag panels by their header, resize from the bottom-right corner.
          Nothing is saved until you click Save layout.
        </p>
      ) : null}

      {panels.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No panels yet</EmptyTitle>
            <EmptyDescription>
              Connect an MCP client and ask for the data you want — e.g.
              &quot;add a panel to {dashboard.name} showing daily trail events
              by name&quot;.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div ref={containerRef}>
          <GridLayout
            layout={layout}
            gridConfig={{ cols: 12, rowHeight: 64 }}
            dragConfig={{ enabled: editMode, handle: ".panel-drag-handle" }}
            resizeConfig={{ enabled: editMode, handles: ["se"] }}
            width={width || 1200}
            onLayoutChange={(next) => {
              if (!editMode) return
              const changed =
                JSON.stringify(
                  next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
                ) !==
                JSON.stringify(
                  layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
                )
              // Buffer only — persisted on "Save layout".
              if (changed) setPendingLayout(next)
            }}
          >
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="bg-card flex flex-col overflow-hidden rounded-lg border shadow-sm"
              >
                <div
                  className={cn(
                    "flex items-center justify-between gap-1 border-b px-3 py-1.5",
                    editMode && "panel-drag-handle cursor-move",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{panel.title}</p>
                    {panel.description ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {panel.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <PanelEditDialog
                      panel={panel}
                      onSave={(title, description) =>
                        updatePanel.mutate({ id: panel.id, title, description })
                      }
                    />
                    {editMode ? (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={(props) => (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Remove ${panel.title}`}
                              className="text-muted-foreground"
                              onMouseDown={(event) => event.stopPropagation()}
                              {...props}
                            >
                              <XIcon />
                            </Button>
                          )}
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove &quot;{panel.title}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              The panel and its query are deleted from this
                              dashboard. Re-adding it later means re-creating
                              it via MCP.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePanel.mutate(panel.id)}
                            >
                              Remove panel
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                </div>
                <div className="min-h-0 flex-1 p-2">
                  <PanelBody teamId={teamId} panel={panel} range={range} />
                </div>
              </div>
            ))}
          </GridLayout>
        </div>
      )}
    </div>
  )
}

function ShareRow({
  share,
  onToggleDisabled,
  onDelete,
}: {
  share: {
    id: string
    token: string
    disabled: boolean
    expiresAt: string | Date | null
  }
  onToggleDisabled: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const expired =
    share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="min-w-0">
        <button
          type="button"
          className="flex max-w-72 items-center gap-1 text-left font-mono text-xs underline-offset-2 hover:underline"
          onClick={() => {
            void navigator.clipboard.writeText(
              `${window.location.origin}/share/d/${share.token}`,
            )
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          title="Copy link"
        >
          <span className="truncate">/share/d/{share.token}</span>
          {copied ? <CheckIcon className="size-3 shrink-0" /> : null}
        </button>
        <div className="mt-1 flex items-center gap-1">
          {share.disabled ? (
            <Badge variant="destructive">Disabled</Badge>
          ) : expired ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )}
          {share.expiresAt ? (
            <span className="text-muted-foreground text-xs">
              until {new Date(share.expiresAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={onToggleDisabled}>
          {share.disabled ? "Enable" : "Disable"}
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  )
}

function PanelEditDialog({
  panel,
  onSave,
}: {
  panel: PanelMeta
  onSave: (title: string, description: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(panel.title)
  const [description, setDescription] = useState(panel.description ?? "")
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setTitle(panel.title)
          setDescription(panel.description ?? "")
        }
      }}
    >
      <DialogTrigger
        render={(props) => (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Edit ${panel.title}`}
            className="text-muted-foreground"
            onMouseDown={(event) => event.stopPropagation()}
            {...props}
          >
            <PencilIcon />
          </Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit panel</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`panel-title-${panel.id}`}>Title</FieldLabel>
            <Input
              id={`panel-title-${panel.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`panel-description-${panel.id}`}>
              Description
            </FieldLabel>
            <Input
              id={`panel-description-${panel.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <FieldDescription>
              Optional context shown under the title.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={() => {
              onSave(title, description)
              setOpen(false)
            }}
            disabled={!title}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PanelBody({
  teamId,
  panel,
  range,
}: {
  teamId: string
  panel: PanelMeta
  range: TimeRange
}) {
  const dataQuery = useQuery({
    queryKey: ["panel-data", teamId, panel.id, range.fromMs, range.toMs],
    queryFn: () => dashboardsClient.runPanel({ teamId, panelId: panel.id, range }),
  })
  if (dataQuery.isLoading || !dataQuery.data) {
    return <Skeleton className="h-full w-full" />
  }
  if (!dataQuery.data.ok) {
    return (
      <div className="text-destructive flex h-full items-center p-2 text-xs">
        {dataQuery.data.error}
      </div>
    )
  }
  return (
    <PanelChart
      chartType={panel.chartType}
      config={panel.config}
      data={dataQuery.data}
    />
  )
}
