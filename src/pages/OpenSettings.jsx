import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { openSettings } from "../hooks/useSettingsDialog"

// /account and /profile open the Account window, /settings the Settings window, over the home page
function OpenSettings({ section }) {
  useEffect(() => {
    openSettings(section)
  }, [section])
  return <Navigate to="/" replace />
}

export default OpenSettings
