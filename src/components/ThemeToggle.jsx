import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "../hooks/useTheme"

function ThemeToggle({ className = "" }) {
  const { dark, toggleTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="outline"
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
