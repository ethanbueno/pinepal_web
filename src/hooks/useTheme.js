import { useState } from "react"

// Applies the theme class. Browsers with the View Transitions API get a quick crossfade
// between the old and new look (timing in index.css); others, and reduced motion, switch instantly.
function applyTheme(dark) {
  const apply = () => document.documentElement.classList.toggle("dark", dark)
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!document.startViewTransition || reducedMotion) {
    apply()
    return
  }
  document.startViewTransition(apply)
}

// light/dark via the "dark" class on <html>; the choice is remembered in localStorage
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  const toggleTheme = () => {
    const next = !dark
    applyTheme(next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // storage unavailable; theme still applies for this visit
    }
    setDark(next)
  }

  return { dark, toggleTheme }
}
