import { useSyncExternalStore } from "react"

// Whether the Settings window is open and which section it shows, shared by the sidebar's
// account menu (which opens it) and Layout (which draws it once).

let state = { open: false, section: "account" }
const listeners = new Set()

function set(next) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

export const openSettings = (section = "account") => set({ open: true, section })
export const closeSettings = () => set({ open: false })
export const showSettingsSection = (section) => set({ section })

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettingsDialog() {
  return useSyncExternalStore(subscribe, () => state)
}
