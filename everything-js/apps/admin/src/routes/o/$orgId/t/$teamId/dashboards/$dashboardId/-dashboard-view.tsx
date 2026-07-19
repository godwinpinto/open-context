import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout"

import "react-grid-layout/css/styles.css"

import type { ChartType, PanelConfig } from "@open-context/module-dashboards"

import { Badge } from "@open-context/ui/components/badge"
import { Button } from "@open-context/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@open-context/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-context/ui/components/select"
import { Skeleton } from "@open-context/ui/components/skeleton"
import { PanelChart } from "@/components/panel-chart"
import {
  RANGE_PRESETS,
  dashboardsClient,
  rangeForKey,
  type RangeKey,
} from "@/lib/modules/dashboards-client"

export default function DashboardView({
  teamId,
  dashboardId,
}: {
  teamId: string
  dashboardId: string
}) {
  const queryClient = useQueryClient()
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d")
  const range = useMemo(() => rangeForKey(rangeKey), [rangeKey])

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", teamId, dashboardId],
    queryFn: () => dashboardsClient.getDashboard({ teamId, id: dashboardId }),
  })
  const dashboard = dashboardQuery.data?.dashboard
  const panels = dashboardQuery.data?.panels ?? []
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

  const layout: Layout = dashboard.layout.map((item) => ({
    i: item.panelId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }))

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{dashboard.name}</h1>
        <div className="flex items-center gap-2">
          <Select
            value={rangeKey}
            onValueChange={(value) => setRangeKey(value as RangeKey)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset.key} value={preset.key}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger
              render={(props) => (
                <Button variant="outline" {...props}>
                  Share
                </Button>
              )}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share dashboard</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                  <div className="space-y-2">
                    {shares.map((share) => {
                      const expired =
                        share.expiresAt &&
                        new Date(share.expiresAt).getTime() < Date.now()
                      return (
                        <div
                          key={share.id}
                          className="flex items-center justify-between gap-2 rounded-md border p-2"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-72 truncate text-left font-mono text-xs underline-offset-2 hover:underline"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/share/d/${share.token}`,
                                )
                              }
                              title="Copy link"
                            >
                              /share/d/{share.token}
                            </button>
                            <div className="mt-1 flex gap-1">
                              {share.disabled ? (
                                <Badge variant="destructive">Disabled</Badge>
                              ) : expired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : (
                                <Badge variant="secondary">Active</Badge>
                              )}
                              {share.expiresAt ? (
                                <span className="text-muted-foreground text-xs">
                                  until{" "}
                                  {new Date(share.expiresAt).toLocaleDateString()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setShareDisabled.mutate({
                                  id: share.id,
                                  disabled: !share.disabled,
                                })
                              }
                            >
                              {share.disabled ? "Enable" : "Disable"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteShare.mutate(share.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {panels.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No panels yet. Connect an MCP client and ask for the data you want —
          e.g. &quot;add a panel to {dashboard.name} showing daily trail events
          by name&quot;.
        </div>
      ) : (
        <div ref={containerRef}>
          <GridLayout
            layout={layout}
            gridConfig={{ cols: 12, rowHeight: 64 }}
            dragConfig={{ handle: ".panel-drag-handle" }}
            width={width || 1200}
            onLayoutChange={(next) => {
              // Persist only real changes (RGL fires on mount too).
              const changed =
                JSON.stringify(
                  next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
                ) !==
                JSON.stringify(
                  layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
                )
              if (changed) saveLayout.mutate(next)
            }}
          >
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="bg-card flex flex-col overflow-hidden rounded-lg border shadow-sm"
              >
                <div className="panel-drag-handle flex cursor-move items-center justify-between border-b px-3 py-1.5">
                  <p className="truncate text-sm font-medium">{panel.title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive h-6 px-1.5 text-xs"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => deletePanel.mutate(panel.id)}
                  >
                    ✕
                  </Button>
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

function PanelBody({
  teamId,
  panel,
  range,
}: {
  teamId: string
  panel: { id: string; chartType: ChartType; config: PanelConfig }
  range: { fromMs: number; toMs: number }
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
