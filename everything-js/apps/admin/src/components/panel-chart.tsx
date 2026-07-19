import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ChartType, PanelConfig } from "@open-context/module-dashboards"

// Renders one panel's query result as its saved chart type. Shared by
// the admin dashboard grid and the public share view. Keys (xKey/
// yKeys/valueKey) come from the AI-authored panel config, with
// column-order fallbacks so a sparse config still renders.

export type PanelData = {
  columns: string[]
  rows: Record<string, unknown>[]
}

const PALETTE = [
  "var(--chart-1, #6366f1)",
  "var(--chart-2, #22c55e)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #ef4444)",
  "var(--chart-5, #06b6d4)",
  "#a855f7",
  "#ec4899",
  "#84cc16",
]

function resolveKeys(config: PanelConfig, columns: string[]) {
  const xKey = config.xKey ?? columns[0] ?? "x"
  const yKeys =
    config.yKeys && config.yKeys.length > 0
      ? config.yKeys
      : columns.filter((column) => column !== xKey).slice(0, 5)
  const valueKey = config.valueKey ?? yKeys[0] ?? columns[1] ?? columns[0] ?? "value"
  return { xKey, yKeys, valueKey }
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function PanelChart({
  chartType,
  config,
  data,
}: {
  chartType: ChartType
  config: PanelConfig
  data: PanelData
}) {
  const { xKey, yKeys, valueKey } = resolveKeys(config, data.columns)

  if (data.rows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No data in range
      </div>
    )
  }

  if (chartType === "stat") {
    const value = toNumber(data.rows[0]?.[valueKey])
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-4xl font-semibold tabular-nums">
          {Intl.NumberFormat().format(value)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{valueKey}</p>
      </div>
    )
  }

  if (chartType === "table") {
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-muted/50 text-left">
              {data.columns.map((column) => (
                <th key={column} className="px-2 py-1.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 100).map((row, index) => (
              <tr key={index} className="border-b last:border-0">
                {data.columns.map((column) => (
                  <td key={column} className="px-2 py-1 font-mono">
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (chartType === "pie") {
    const slices = data.rows.slice(0, 12).map((row) => ({
      name: String(row[xKey] ?? "?"),
      value: toNumber(row[valueKey]),
    }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" outerRadius="75%" label>
            {slices.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const rows = data.rows.map((row) => ({
    ...row,
    [xKey]: String(row[xKey] ?? ""),
    ...Object.fromEntries(yKeys.map((key) => [key, toNumber(row[key])])),
  }))

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey={xKey} fontSize={11} tickLine={false} />
      <YAxis fontSize={11} tickLine={false} width={44} />
      <Tooltip />
      {yKeys.length > 1 ? <Legend /> : null}
    </>
  )

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          {axes}
          {yKeys.map((key, index) => (
            <Bar key={key} dataKey={key} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          {axes}
          {yKeys.map((key, index) => (
            <Area
              key={key}
              dataKey={key}
              stroke={PALETTE[index % PALETTE.length]}
              fill={PALETTE[index % PALETTE.length]}
              fillOpacity={0.25}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows}>
        {axes}
        {yKeys.map((key, index) => (
          <Line
            key={key}
            dataKey={key}
            stroke={PALETTE[index % PALETTE.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
