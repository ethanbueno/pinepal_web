import { useEffect, useState } from "react"
import { GlobeIcon, HistoryIcon, SmartphoneIcon } from "lucide-react"
import { getLoginHistory } from "../api/loginHistory"
import { getRoleLabel } from "../utils/roles"
import { formatDateTime } from "../utils/format"
import PageHeader from "../components/PageHeader"
import ErrorAlert from "../components/ErrorAlert"
import EmptyState from "../components/EmptyState"
import LoadingBlocks from "../components/LoadingBlocks"
import Pagination from "../components/Pagination"
import SelectField from "../components/SelectField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const PER_PAGE = 25
const emptyFilters = { search: "", result: "", platform: "" }

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

function Field({ label, children, className }) {
  return (
    <div className={"w-full sm:w-auto " + (className || "")}>
      <Label className="mb-1.5 text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

// Every sign-in attempt on the web and the mobile app, newest first. Admins only:
// the route and the sidebar link are admin-only, and the server refuses everyone else.
function LoginHistory() {
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false
    getLoginHistory({ ...filters, page, per_page: PER_PAGE })
      .then((result) => {
        if (ignore) return
        setData(result)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load the login history.")
        setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [filters, page])

  const changeFilter = (name, value) => {
    setFilters({ ...filters, [name]: value })
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Login history"
        description="Every sign-in attempt on the web and the mobile app, newest first. Passwords are never saved."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-48 grow">
            <Input
              placeholder="Name or username"
              value={filters.search}
              onChange={(e) => changeFilter("search", e.target.value)}
            />
          </Field>
          <Field label="Result">
            <SelectField
              className="w-full sm:w-36"
              allLabel="All results"
              value={filters.result}
              onChange={(v) => changeFilter("result", v)}
              options={RESULTS}
            />
          </Field>
          <Field label="Where">
            <SelectField
              className="w-full sm:w-36"
              allLabel="Web and app"
              value={filters.platform}
              onChange={(v) => changeFilter("platform", v)}
              options={PLATFORMS}
            />
          </Field>
          <Button
            variant="outline"
            onClick={() => {
              setFilters(emptyFilters)
              setPage(1)
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading ? (
        <LoadingBlocks rows={8} height="h-10" label="Loading the login history" />
      ) : !error && data.items.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No sign-ins to show"
          text="No sign-in attempts match these filters yet."
        />
      ) : (
        !error && (
          <>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Where</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>IP address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const PlatformIcon = item.platform === "mobile" ? SmartphoneIcon : GlobeIcon
                    return (
                      <TableRow key={item.id} className={item.success ? "" : "bg-destructive/5"}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(item.created_at)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{item.full_name || item.username}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.full_name ? item.username : "No matching account"}
                            {item.role && ` · ${getRoleLabel(item.role)}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.success ? (
                            <Badge className="bg-green-600/15 text-green-700 dark:text-green-400">Success</Badge>
                          ) : (
                            <div className="flex flex-col items-start gap-0.5">
                              <Badge variant="destructive">Failed</Badge>
                              {item.reason && (
                                <span className="text-xs text-destructive">{REASONS[item.reason] || item.reason}</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <PlatformIcon className="size-3.5 text-muted-foreground" />
                            {item.platform === "mobile" ? "Mobile app" : "Web"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{deviceName(item.user_agent)}</TableCell>
                        <TableCell className="tabular-nums">{item.ip_address || "–"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
            <Pagination page={page} perPage={PER_PAGE} total={data.total} onChange={setPage} />
          </>
        )
      )}
    </div>
  )
}

export default LoginHistory
