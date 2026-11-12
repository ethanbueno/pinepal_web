import { useState } from "react"
import { cn } from "@/lib/utils"
import PasswordToggle from "./PasswordToggle"

// Input whose label is hint text (placeholder) inside the box; it disappears once you type,
// matching the mobile app. The label is also given to screen readers via aria-label.
// Used on the Login and Register pages.
// size="compact" (40 px tall, 15 px text, 10 px corners; used on Login and Register) is the smaller box;
// the default is the roomy 56 px one.
const SIZES = {
  default: "h-14 rounded-xl px-4 text-base",
  compact: "h-10 rounded-[10px] px-4 text-[15px]",
}

// type="password" also gets an eye button to show or hide what was typed
function FloatingInput({ id, label, className, size = "default", type, ...props }) {
  const look = SIZES[size] || SIZES.default
  const isPassword = type === "password"
  const [shown, setShown] = useState(false)
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        placeholder={label}
        aria-label={label}
        type={isPassword && shown ? "text" : type}
        className={cn(
          "w-full border border-input bg-card outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/25",
          look,
          isPassword && "pr-11"
        )}
        {...props}
      />
      {isPassword && <PasswordToggle shown={shown} onToggle={() => setShown(!shown)} className="right-2" />}
    </div>
  )
}

export default FloatingInput
