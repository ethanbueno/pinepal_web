import { useEffect, useSyncExternalStore } from "react"
import { getAppDownloadUrl } from "../api/settings"
import { APP_DOWNLOAD_URL } from "../config/app"

// The mobile app's download link, as an admin last saved it (Settings > Mobile app), shared by the
// login page and the sidebar. It starts on the built-in link, so the button always works,
// and is fetched once per page load. setAppDownloadUrl() updates every user of it at once.

let current = APP_DOWNLOAD_URL
let request = null
const listeners = new Set()

export function setAppDownloadUrl(url) {
  current = url || APP_DOWNLOAD_URL
  listeners.forEach((listener) => listener())
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getSnapshot = () => current

export function useAppDownloadUrl() {
  useEffect(() => {
    if (request) return
    request = getAppDownloadUrl()
      .then(setAppDownloadUrl)
      .catch((err) => {
        console.error(err)
        request = null // try again next time something needs it
      })
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot)
}
