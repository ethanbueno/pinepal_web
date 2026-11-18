import { useEffect, useState } from "react"

// Applies the theme class. Browsers with the View Transitions API get a quick crossfade
// between the old and new look (timing in index.css); others, and reduced motion, switch instantly.
function applyTheme(dark) {
  if (document.documentElement.classList.contains("dark") === dark) return
  const apply = () => document.documentElement.classList.toggle("dark", dark)
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!document.startViewTransition || reducedMotion) {
    apply()
    return
  }
  document.startViewTransition(apply)
}

const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)")

function storedMode() {
  try {
    const mode = localStorage.getItem("theme")
    return mode === "dark" || mode === "system" ? mode : "light"
  } catch {
    return "light"
  }
}

// light / dark / system ("Device", like the mobile app) via the "dark" class on <html>.
// The choice is remembered in localStorage; index.html applies it before the page draws.
export function useTheme() {
  const [mode, setModeState] = useState(storedMode)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  // on Device, follow the phone or computer when it switches
  useEffect(() => {
    if (mode !== "system") return
    const query = systemQuery()
    const onChange = (e) => {
      applyTheme(e.matches)
      setDark(e.matches)
    }
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [mode])

  const setMode = (next) => {
    const nextDark = next === "system" ? systemQuery().matches : next === "dark"
    applyTheme(nextDark)
    try {
      localStorage.setItem("theme", next)
    } catch {
      // storage unavailable; theme still applies for this visit
    }
    setModeState(next)
    setDark(nextDark)
  }

  const toggleTheme = () => setMode(dark ? "light" : "dark")

  return { mode, setMode, dark, toggleTheme }
}
