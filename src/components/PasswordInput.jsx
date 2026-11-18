import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import PasswordToggle from "./PasswordToggle"

// A password box with an eye button to show or hide what was typed.
// Takes the same props as Input (no need to pass type).
function PasswordInput({ className, ...props }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pr-11 md:pr-9", className)} />
      <PasswordToggle shown={shown} onToggle={() => setShown(!shown)} className="size-6" />
    </div>
  )
}

export default PasswordInput
