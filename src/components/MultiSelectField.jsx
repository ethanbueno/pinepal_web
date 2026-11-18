import { useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// A dropdown where several options can be ticked, in the same style as SelectField.
// value = the ticked values ([] = none ticked, shown as allLabel). options = [{ value, label, color? }];
// color adds a dot in front (the disease colors). The menu stays open while ticking.
function MultiSelectField({ id, value, onChange, options, allLabel = "All", className = "w-full" }) {
  const [open, setOpen] = useState(false)

  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const picked = options.filter((o) => value.includes(o.value))
  const summary =
    picked.length === 0 ? allLabel : picked.length === 1 ? picked[0].label : `${picked.length} selected`

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        className={cn(
          "flex h-10 min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring md:h-7 md:text-sm dark:bg-input/30",
          className
        )}
      >
        {picked.length > 0 && (
          <span className="flex shrink-0 -space-x-1">
            {picked.slice(0, 4).map((o) =>
              o.color ? (
                <span
                  key={o.value}
                  className="size-2.5 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: o.color }}
                />
              ) : null
            )}
          </span>
        )}
        <span className="flex-1 truncate">{summary}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} className="isolate z-50">
          <Popover.Popup className="w-(--anchor-width) min-w-52 origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex-1">{allLabel}</span>
              {value.length === 0 && <CheckIcon className="size-4" />}
            </button>
            <div className="my-1 h-px bg-border" />
            {options.map((o) => {
              const on = value.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {o.color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
                  <span className="flex-1">{o.label}</span>
                  {on && <CheckIcon className="size-4" />}
                </button>
              )
            })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default MultiSelectField
