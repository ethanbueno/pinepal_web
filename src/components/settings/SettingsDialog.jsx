import { useState } from "react"
import { DatabaseBackupIcon, DownloadIcon, MonitorSmartphoneIcon, MoonIcon, PaletteIcon, SmartphoneIcon, SunIcon, XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useAuth } from "../../context/AuthContext"
import { useTheme } from "../../hooks/useTheme"
import { closeSettings, showSettingsSection, useSettingsDialog } from "../../hooks/useSettingsDialog"
import AppDownloadForm from "../AppDownloadForm"
import { useToast } from "../toastcontext"
import { downloadBackup } from "../../api/backup"
import AccountSection from "./AccountSection"
import SettingsRow from "./SettingsRow"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// One choice of the theme switch
function ThemeOption({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function AppearanceSection() {
  const { mode, setMode } = useTheme()
  return (
    <div className="divide-y">
      <SettingsRow label="Theme" hint="Device follows your phone or computer.">
        <div role="radiogroup" aria-label="Theme" className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto">
          <ThemeOption active={mode === "light"} icon={SunIcon} label="Light" onClick={() => setMode("light")} />
          <ThemeOption active={mode === "dark"} icon={MoonIcon} label="Dark" onClick={() => setMode("dark")} />
          <ThemeOption
            active={mode === "system"}
            icon={MonitorSmartphoneIcon}
            label="Device"
            onClick={() => setMode("system")}
          />
        </div>
      </SettingsRow>
    </div>
  )
}

function MobileAppSection() {
  return (
    <div className="divide-y">
      <SettingsRow label="Download Link" hint="Download mobile app on the login page and in the sidebar, for everyone.">
        <div className="w-full sm:max-w-sm">
          <AppDownloadForm />
        </div>
      </SettingsRow>
    </div>
  )
}

// The Settings sections. Account is its own window (same look, no section list), opened
// from the account menu's Account item.
// Admins only: download an encrypted copy of the whole database (backend/admin_backup.py).
// Restoring one stays a script (backend/restore.py).
function BackupSection() {
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const handleBackup = async () => {
    setBusy(true)
    setError("")
    try {
      await downloadBackup()
      notify("Backup downloaded.")
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="divide-y">
      <SettingsRow
        label="Database Backup"
        hint="Every table and the photos on the server, in one encrypted .zip. Keep it somewhere safe, like Google Drive."
      >
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button onClick={handleBackup} disabled={busy}>
            <DownloadIcon />
            {busy ? "Preparing backup..." : "Download Backup"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </SettingsRow>
      <SettingsRow label="Restoring" hint="Restoring replaces the database, so it is done by hand with restore.py and the encryption key.">
        <span className="text-sm text-muted-foreground">See BACKUP_AND_RECOVERY.md</span>
      </SettingsRow>
    </div>
  )
}

const SECTIONS = [
  { key: "appearance", label: "Appearance", icon: PaletteIcon, Content: AppearanceSection },
  { key: "mobile-app", label: "Mobile App", icon: SmartphoneIcon, Content: MobileAppSection, adminOnly: true },
  { key: "backup", label: "Backup", icon: DatabaseBackupIcon, Content: BackupSection, adminOnly: true },
]

// Settings (and Account), opened from the sidebar's account menu: a large window over the page (at most
// 1280 x 1000px, with room around it, like claude.ai's Settings) with the
// sections on the left and the chosen one on the right. Full screen on phones, where the
// sections become a row of tabs along the top.
function SettingsDialog() {
  const { user } = useAuth()
  const { open, section } = useSettingsDialog()
  if (!user) return null

  const isAccount = section === "account"
  const sections = SECTIONS.filter((s) => !s.adminOnly || user.role === "admin")
  const active = isAccount
    ? { key: "account", label: "Account", Content: AccountSection }
    : (sections.find((s) => s.key === section) ?? sections[0])
  const Content = active.Content

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && closeSettings()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground outline-none duration-100",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[calc(100dvh-8rem)] sm:max-h-[62.5rem] sm:w-[calc(100vw-4rem)] sm:max-w-[80rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:shadow-xl sm:ring-1 sm:ring-foreground/10",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-5">
            <DialogPrimitive.Title className="text-xl font-semibold tracking-tight">
              {isAccount ? "Account" : "Settings"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" />}>
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {!isAccount && (
            <nav
              aria-label="Settings sections"
              className="flex shrink-0 gap-1 overflow-x-auto border-b px-4 pb-2 sm:w-52 sm:flex-col sm:overflow-visible sm:border-b-0 sm:px-3 sm:pb-4"
            >
              {sections.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => showSettingsSection(key)}
                  aria-current={active.key === key ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                    active.key === key
                      ? "bg-primary/15 text-primary-text"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </nav>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
              {!isAccount && (
                <h2 className="pt-3 pb-1 text-base font-semibold text-primary-text sm:pt-1">{active.label}</h2>
              )}
              <Content />
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default SettingsDialog
