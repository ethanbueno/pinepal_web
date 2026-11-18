import { useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// A date field in PinePal's own style, in place of the browser's date picker.
// value and onChange use "YYYY-MM-DD" ("" = no date), like <input type="date">, so
// filters keep working the same. min / max grey out the days outside them.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const pad = (n) => String(n).padStart(2, "0")
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function parseIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "")
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

const shown = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

// the 42 days (6 weeks) shown for a month, starting on the Sunday before the 1st
function monthDays(year, month) {
  const start = new Date(year, month, 1)
  start.setDate(1 - start.getDay())
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function DatePicker({ id, value, onChange, min, max, placeholder = "Any date", className, disabled }) {
  const selected = parseIso(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => selected || new Date()) // the month on screen

  const todayIso = toIso(new Date())
  const outOfRange = (iso) => (min && iso < min) || (max && iso > max)

  const openChange = (next) => {
    if (next) setView(parseIso(value) || new Date()) // open on the chosen month
    setOpen(next)
  }

  const pick = (iso) => {
    onChange(iso)
    setOpen(false)
  }

  const year = view.getFullYear()
  const month = view.getMonth()
  const moveMonth = (by) => setView(new Date(year, month + by, 1))

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger
        id={id}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-popup-open:border-ring md:h-7 md:text-sm dark:bg-input/30",
          className
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? shown(selected) : placeholder}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50">
          <Popover.Popup className="w-72 origin-(--transform-origin) rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-border outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Previous month"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <div className="text-sm font-semibold" aria-live="polite">
                {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Next month"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthDays(year, month).map((day) => {
                const iso = toIso(day)
                const isSelected = iso === value
                const inMonth = day.getMonth() === month
                const off = outOfRange(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={off}
                    onClick={() => pick(iso)}
                    aria-label={shown(day)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-30",
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : iso === todayIso
                          ? "font-semibold text-primary-text ring-1 ring-primary/50 ring-inset hover:bg-primary/15"
                          : inMonth
                            ? "hover:bg-muted"
                            : "text-muted-foreground/60 hover:bg-muted"
                    )}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <button
                type="button"
                onClick={() => pick("")}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={outOfRange(todayIso)}
                onClick={() => pick(todayIso)}
                className="rounded-md px-2 py-1 text-sm font-medium text-primary-text hover:bg-primary/15 disabled:opacity-40"
              >
                Today
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default DatePicker
