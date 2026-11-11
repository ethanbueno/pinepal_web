import { useEffect, useState } from "react"
import { GlobeIcon, HistoryIcon, SmartphoneIcon } from "lucide-react"
import { getLoginHistory } from "../api/loginHistory"
import { getRoleLabel } from "../utils/roles"
import { formatDateTime } from "../utils/format"
import ErrorAlert from "./ErrorAlert"
import SelectField from "./SelectField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const PER_PAGE = 25

const RESULTS = [
  { value: "success", label: "Successful" },
  { value: "failed", label: "Failed" },
]
const PLATFORMS = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile app" },
]

// why an attempt failed (login_history.reason in the backend)
const REASONS = {
  wrong_password: "Wrong password",
  unknown_user: "No such account",
  deactivated: "Account deactivated",
}

// "Chrome on Windows", "PinePal app" ... from the browser's user agent, good enough to tell devices apart
function deviceName(agent) {
  if (!agent) return "Unknown device"
  if (/dart/i.test(agent)) return "PinePal app"
  const browser = /edg\//i.test(agent)
    ? "Edge"
    : /chrome|crios/i.test(agent)
      ? "Chrome"
      : /firefox|fxios/i.test(agent)
        ? "Firefox"
        : /safari/i.test(agent)
          ? "Safari"
          : null
  const system = /android/i.test(agent)
    ? "Android"
    : /iphone|ipad/i.test(agent)
      ? "iPhone"
      : /windows/i.test(agent)
        ? "Windows"
        : /mac os/i.test(agent)
          ? "Mac"
          : /linux/i.test(agent)
            ? "Linux"
            : null
  if (browser && system) return `${browser} on ${system}`
  return browser || system || agent.slice(0, 40)
}

function Entry({ item }) {
  const PlatformIcon = item.platform === "mobile" ? SmartphoneIcon : GlobeIcon
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.full_name || item.username}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.full_name ? item.username : "No matching account"}
            {item.role && ` · ${getRoleLabel(item.role)}`}
          </p>
        </div>
        {item.success ? (
          <Badge className="shrink-0 bg-green-600/15 text-green-700 dark:text-green-400">Success</Badge>
        ) : (
          <Badge variant="destructive" className="shrink-0">
            Failed
          </Badge>
        )}
      </div>
      {!item.success && item.reason && <p className="text-xs text-destructive">{REASONS[item.reason] || item.reason}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <PlatformIcon className="size-3.5" />
          {item.platform === "mobile" ? "Mobile app" : "Web"}
        </span>
        <span>{formatDateTime(item.created_at)}</span>
        <span>{deviceName(item.user_agent)}</span>
        {item.ip_address && <span className="tabular-nums">IP {item.ip_address}</span>}
      </div>
    </li>
  )
}

// A drawer from the right with every sign-in attempt, newest first. Admins only:
// the sidebar shows its button only to admins, and the server refuses everyone else.
function LoginHistoryDrawer({ open, onOpenChange }) {
  const [filters, setFilters] = useState({ search: "", result: "", platform: "" })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  // load when the drawer opens and whenever the filters or the page change
  useEffect(() => {
    if (!open) return
    let ignore = false
    getLoginHistory({ ...filters, page, per_page: PER_PAGE })
      .then((result) => {
        if (ignore) return
        setData(result)
        setError("")
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load the login history.")
      })
    return () => {
      ignore = true
    }
  }, [open, filters, page])

  const changeFilter = (name, value) => {
    setFilters({ ...filters, [name]: value })
    setPage(1)
  }

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" /> Login history
          </SheetTitle>
          <SheetDescription>Every sign-in attempt on the web and the mobile app, newest first.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 border-b p-4">
          <Input
            placeholder="Search name or username"
            value={filters.search}
            onChange={(e) => changeFilter("search", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              allLabel="All results"
              value={filters.result}
              onChange={(v) => changeFilter("result", v)}
              options={RESULTS}
            />
            <SelectField
              allLabel="Web and app"
              value={filters.platform}
              onChange={(v) => changeFilter("platform", v)}
              options={PLATFORMS}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <ErrorAlert className="">{error}</ErrorAlert>}
          {!error && !data && (
            <div className="flex flex-col gap-2" aria-label="Loading">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-20 rounded-lg" />
              ))}
            </div>
          )}
          {!error && data && data.items.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No sign-ins match these filters.</p>
          )}
          {!error && data && data.items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {data.items.map((item) => (
                <Entry key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground tabular-nums">
              Page {page} of {lastPage} · {data.total} {data.total === 1 ? "sign-in" : "sign-ins"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default LoginHistoryDrawer
