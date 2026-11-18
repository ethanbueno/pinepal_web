import { ChevronRightIcon, LogOutIcon, MonitorSmartphoneIcon, MoonIcon, SunIcon } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../hooks/useTheme"
import { useToast } from "../components/toastcontext"
import { getRoleLabel } from "../utils/roles"
import PageHeader from "../components/PageHeader"
import AppDownloadCard from "../components/AppDownloadCard"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?"

function SectionTitle({ children }) {
  return <CardTitle className="text-base font-semibold text-primary-text">{children}</CardTitle>
}

// One choice of the Appearance switch
function ThemeOption({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

// Settings, like the mobile app's: the account (with a way into Profile), the light or
// dark look, and for admins the mobile app's download link.
function Settings() {
  const { user, logout } = useAuth()
  const { mode, setMode } = useTheme()
  const navigate = useNavigate()
  const notify = useToast()

  // the same as Log out in the sidebar menu
  const handleLogout = () => {
    logout()
    notify("You have been signed out.", "info")
    navigate("/login")
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <SectionTitle>Account</SectionTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <Link
            to="/profile"
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
          >
            <Avatar className="size-10 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">Profile</div>
              <div className="truncate text-xs text-muted-foreground">
                {user.full_name} · {getRoleLabel(user.role)}
              </div>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle>Appearance</SectionTitle>
          <CardDescription>Device follows your phone or computer. Remembered on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-lg bg-muted p-1 sm:max-w-sm">
            <ThemeOption active={mode === "light"} icon={SunIcon} label="Light" onClick={() => setMode("light")} />
            <ThemeOption active={mode === "dark"} icon={MoonIcon} label="Dark" onClick={() => setMode("dark")} />
            <ThemeOption active={mode === "system"} icon={MonitorSmartphoneIcon} label="Device" onClick={() => setMode("system")} />
          </div>
        </CardContent>
      </Card>

      {user.role === "admin" && <AppDownloadCard />}

      <Button variant="outline" className="self-start text-destructive hover:text-destructive" onClick={handleLogout}>
        <LogOutIcon className="size-4" /> Log out
      </Button>
    </div>
  )
}

export default Settings
