import { useState } from "react"
import { CalendarRange, ChevronDown } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@open-context/ui/components/button"
import { Input } from "@open-context/ui/components/input"
import { Label } from "@open-context/ui/components/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RANGE_PRESETS, type RangeKey } from "@/lib/modules/dashboards-client"

export type TimeRange = { fromMs: number; toMs: number }

function formatStamp(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// The dashboard's global date filter: labeled control, popover with
// relative presets on the left and a calendar-based custom date-time
// range on the right. Also used on the public share view.
export function TimeRangePicker({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (range: TimeRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [presetKey, setPresetKey] = useState<RangeKey | "custom">("7d")
  const [draft, setDraft] = useState<DateRange | undefined>()
  const [fromTime, setFromTime] = useState("00:00")
  const [toTime, setToTime] = useState("23:59")

  const triggerLabel =
    presetKey === "custom"
      ? `${formatStamp(value.fromMs)} – ${formatStamp(value.toMs)}`
      : RANGE_PRESETS.find((preset) => preset.key === presetKey)!.label

  const applyCustom = () => {
    if (!draft?.from) return
    const [fh, fm] = fromTime.split(":").map(Number)
    const [th, tm] = toTime.split(":").map(Number)
    const from = new Date(draft.from)
    from.setHours(fh ?? 0, fm ?? 0, 0, 0)
    const to = new Date(draft.to ?? draft.from)
    to.setHours(th ?? 23, tm ?? 59, 59, 999)
    if (from.getTime() >= to.getTime()) return
    setPresetKey("custom")
    onChange({ fromMs: from.getTime(), toMs: to.getTime() })
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Label className="text-muted-foreground shrink-0 text-xs">
        Time range
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={(props) => (
            <Button variant="outline" size="sm" {...props}>
              <CalendarRange className="h-3.5 w-3.5" />
              {triggerLabel}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          )}
        />
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex">
            <div className="flex w-36 flex-col gap-0.5 border-r p-2">
              {RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  variant={presetKey === preset.key ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setPresetKey(preset.key)
                    onChange({ fromMs: Date.now() - preset.ms, toMs: Date.now() })
                    setOpen(false)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <p className="text-muted-foreground mt-2 px-2 text-xs">
                Custom range →
              </p>
            </div>
            <div className="flex flex-col gap-2 p-3">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={draft}
                onSelect={setDraft}
                defaultMonth={new Date(value.fromMs)}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="h-8 w-28"
                  value={fromTime}
                  onChange={(event) => setFromTime(event.target.value)}
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="time"
                  className="h-8 w-28"
                  value={toTime}
                  onChange={(event) => setToTime(event.target.value)}
                />
                <Button size="sm" onClick={applyCustom} disabled={!draft?.from}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
