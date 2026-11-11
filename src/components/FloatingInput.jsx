import { cn } from "@/lib/utils"

// Input with its label sitting inside the box, moving up once the box has focus or text.
// placeholder=" " is what lets peer-placeholder-shown tell an empty box apart.
// Used on the Login and Register pages.
// size="compact" (48 px, used on Login and Register) is the smaller box; the default is the roomy 56 px one.
const SIZES = {
  default: {
    input: "h-14 rounded-xl px-4 pt-5 pb-1.5 text-base",
    label:
      "top-2 left-4 text-xs peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs",
  },
  compact: {
    input: "h-12 rounded-lg px-4 pt-5 pb-0.5 text-base",
    label:
      "top-1.5 left-4 text-xs peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs",
  },
}

function FloatingInput({ id, label, className, size = "default", ...props }) {
  const look = SIZES[size] || SIZES.default
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        placeholder=" "
        className={cn(
          "peer w-full border border-input bg-card outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-3 focus:ring-ring/25",
          look.input
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className={cn("pointer-events-none absolute text-muted-foreground transition-all", look.label)}
      >
        {label}
      </label>
    </div>
  )
}

export default FloatingInput
