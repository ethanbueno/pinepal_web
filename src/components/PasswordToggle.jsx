import { EyeIcon, EyeOffIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// The eye button inside a password box: shows the password while "shown" is on.
// It is type="button" so clicking it never submits the form.
function PasswordToggle({ shown, onToggle, className }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      title={shown ? "Hide password" : "Show password"}
      className={cn(
        "absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
    </button>
  )
}

export default PasswordToggle
