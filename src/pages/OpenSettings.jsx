import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { openSettings } from "../hooks/useSettingsDialog"

// /account, /profile and /settings: open the Settings window at that section, over the home page
function OpenSettings({ section }) {
  useEffect(() => {
    openSettings(section)
  }, [section])
  return <Navigate to="/" replace />
}

export default OpenSettings
