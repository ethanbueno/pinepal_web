import { useState } from "react"

// light/dark via the "dark" class on <html>; the choice is remembered in localStorage
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  const toggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // storage unavailable; theme still applies for this visit
    }
    setDark(next)
  }

  return { dark, toggleTheme }
}
