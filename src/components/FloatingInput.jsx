import { cn } from "@/lib/utils"

// Input with its label sitting inside the box, moving up once the box has focus or text.
// placeholder=" " is what lets peer-placeholder-shown tell an empty box apart.
// Used on the Login and Register pages.
function FloatingInput({ id, label, className, ...props }) {
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        placeholder=" "
        className="peer h-14 w-full rounded-xl border border-input bg-card px-4 pt-5 pb-1.5 text-base outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-3 focus:ring-ring/25"
        {...props}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-2 left-4 text-xs text-muted-foreground transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs"
      >
        {label}
      </label>
    </div>
  )
}

export default FloatingInput
