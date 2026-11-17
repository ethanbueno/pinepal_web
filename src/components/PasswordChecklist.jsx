import { CheckIcon, CircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { PASSWORD_RULES } from "../utils/passwordRules"

// The password rules under a new-password box, ticked off while you type.
// Hidden until something is typed. Pass confirm to add a "Passwords match" line.
function PasswordChecklist({ password, confirm, className }) {
  if (!password) return null
  const lines = PASSWORD_RULES.map((rule) => ({ key: rule.key, label: rule.label, met: rule.test(password) }))
  if (confirm !== undefined && confirm !== "") {
    lines.push({ key: "match", label: "Passwords match", met: password === confirm })
  }
  return (
    <ul className={cn("space-y-1 text-xs", className)} aria-live="polite">
      {lines.map((line) => (
        <li
          key={line.key}
          className={cn("flex items-center gap-2", line.met ? "text-foreground" : "text-muted-foreground")}
        >
          {line.met ? (
            <CheckIcon className="size-3.5 shrink-0 text-primary-text" strokeWidth={3} aria-hidden />
          ) : (
            <CircleIcon className="size-3.5 shrink-0" aria-hidden />
          )}
          {line.label}
          <span className="sr-only">{line.met ? "(done)" : "(not yet)"}</span>
        </li>
      ))}
    </ul>
  )
}

export default PasswordChecklist
