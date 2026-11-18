import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "../hooks/useTheme"

// bare: just the icon, no box (the login and register pages)
function ThemeToggle({ className = "", bare = false }) {
  const { dark, toggleTheme } = useTheme()

  return (
    <Button
      type="button"
      variant={bare ? "ghost" : "outline"}
      size="icon"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

export default ThemeToggle
