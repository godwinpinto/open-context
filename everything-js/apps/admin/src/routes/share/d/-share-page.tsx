import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import type { ChartType, PanelConfig, PanelLayout } from "@open-context/module-dashboards"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-context/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-context/ui/components/select"
import { Skeleton } from "@open-context/ui/components/skeleton"
import { PanelChart, type PanelData } from "@/components/panel-chart"
import {
  RANGE_PRESETS,
  rangeForKey,
  type RangeKey,
} from "@/lib/modules/dashboards-client"

// Public read-only dashboard view: live data, the viewer controls ONLY
// the global time range. The share token is validated server-side on
// every request; panel SQL never reaches the browser.

type ShareMeta = {
  name: string
  layout: PanelLayout[]
  panels: { id: string; title: string; chartType: ChartType; config: PanelConfig }[]
}

async function shareFetch<T>(path: string): Promise<T> {
  const response = await fetch(`/api/share/d${path}`)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export default function SharePage({ token }: { token: string }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d")
  const range = useMemo(() => rangeForKey(rangeKey), [rangeKey])

  const metaQuery = useQuery({
    queryKey: ["share", token],
    queryFn: () => shareFetch<ShareMeta>(`/${token}`),
    retry: false,
  })

  if (metaQuery.error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard unavailable</CardTitle>
            <CardDescription>
              {metaQuery.error instanceof Error
                ? metaQuery.error.message
                : "This link is invalid, disabled, or expired."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }
  if (!metaQuery.data) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const meta = metaQuery.data
  const layoutByPanel = new Map(meta.layout.map((item) => [item.panelId, item]))
  const ordered = [...meta.panels].sort((a, b) => {
    const la = layoutByPanel.get(a.id)
    const lb = layoutByPanel.get(b.id)
    return (la ? la.y * 12 + la.x : 0) - (lb ? lb.y * 12 + lb.x : 0)
  })

  return (
    <div className="bg-background min-h-svh">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{meta.name}</h1>
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
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {ordered.map((panel) => {
            const item = layoutByPanel.get(panel.id)
            const span = Math.min(Math.max(item?.w ?? 6, 3), 12)
            const height = (item?.h ?? 4) * 64
            return (
              <div
                key={panel.id}
                className="bg-card col-span-1 flex flex-col overflow-hidden rounded-lg border shadow-sm"
                style={{
                  gridColumn: `span ${span} / span ${span}`,
                  height,
                }}
              >
                <div className="border-b px-3 py-1.5">
                  <p className="truncate text-sm font-medium">{panel.title}</p>
                </div>
                <div className="min-h-0 flex-1 p-2">
                  <SharedPanelBody token={token} panel={panel} range={range} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SharedPanelBody({
  token,
  panel,
  range,
}: {
  token: string
  panel: { id: string; chartType: ChartType; config: PanelConfig }
  range: { fromMs: number; toMs: number }
}) {
  const dataQuery = useQuery({
    queryKey: ["share-panel", token, panel.id, range.fromMs, range.toMs],
    queryFn: () =>
      shareFetch<{ ok: true } & PanelData | { ok: false; error: string }>(
        `/${token}/panels/${panel.id}?fromMs=${range.fromMs}&toMs=${range.toMs}`,
      ),
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
    <PanelChart chartType={panel.chartType} config={panel.config} data={dataQuery.data} />
  )
}
