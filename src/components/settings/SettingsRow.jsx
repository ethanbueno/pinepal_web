import { cn } from "@/lib/utils"

// One line of a Settings section: what it is on the left, the value or control on the right.
// Lines are split by thin rules (the section wraps them in divide-y). On phones the two
// halves stack, so long values and forms get the full width.
function SettingsRow({ label, hint, children, className }) {
  return (
    <div className={cn("flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-6", className)}>
      <div className="sm:w-40 sm:shrink-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="min-w-0 flex-1 sm:flex sm:justify-end">{children}</div>
    </div>
  )
}

export default SettingsRow
