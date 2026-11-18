import { useSyncExternalStore } from "react"

// Whether the Settings window is open and which section it shows, shared by the sidebar's
// account menu (which opens it) and Layout (which draws it once).

let state = { open: false, section: "profile" }
const listeners = new Set()

function set(next) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

// Ctrl+, (Cmd+, on a Mac) opens Settings from anywhere, as in most apps
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const SETTINGS_SHORTCUT = isMac ? "⌘," : "Ctrl+,"
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "," && (isMac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      openSettings()
    }
  })
}

export const openSettings = (section = "profile") => set({ open: true, section })
export const closeSettings = () => set({ open: false })
export const showSettingsSection = (section) => set({ section })

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettingsDialog() {
  return useSyncExternalStore(subscribe, () => state)
}
