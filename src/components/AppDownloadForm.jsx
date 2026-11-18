import { useState } from "react"
import { SmartphoneIcon } from "lucide-react"
import { saveAppDownloadUrl } from "../api/settings"
import { setAppDownloadUrl, useAppDownloadUrl } from "../hooks/useAppDownloadUrl"
import { useToast } from "./toastcontext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Admins only (Settings > Mobile app): where the Android app is downloaded from (the login page's Download button
// and the sidebar card). Saved in the database for everyone (backend/app_settings.py).
export default function AppDownloadForm() {
  const notify = useToast()
  const saved = useAppDownloadUrl()
  // what the admin typed, or null to show the stored link (it may still be loading)
  const [draft, setDraft] = useState(null)
  const value = draft ?? saved
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    const url = value.trim()
    setFormError("")
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setFormError("Enter a full link that starts with https://")
      return
    }
    setSaving(true)
    try {
      const stored = await saveAppDownloadUrl(url)
      setAppDownloadUrl(stored)
      setDraft(null)
      notify("Download link saved.")
    } catch (err) {
      console.error(err)
      setFormError(err.response?.data?.error || "Could not save the download link.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <SmartphoneIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="app-download-url"
            type="url"
            inputMode="url"
            aria-label="Download link"
            className="pl-9"
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://"
          />
        </div>
        <Button type="submit" disabled={saving || value.trim() === saved}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </form>
  )
}
