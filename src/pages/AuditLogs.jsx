import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRightIcon, GlobeIcon, ScrollTextIcon, SmartphoneIcon } from "lucide-react"
import { getAuditLogs } from "../api/auditLogs"
import { getUsers } from "../api/users"
import { getRoleLabel } from "../utils/roles"
import { formatDateTime } from "../utils/format"
import PageHeader from "../components/PageHeader"
import ErrorAlert from "../components/ErrorAlert"
import EmptyState from "../components/EmptyState"
import LoadingBlocks from "../components/LoadingBlocks"
import Modal from "../components/Modal"
import Pagination from "../components/Pagination"
import SelectField from "../components/SelectField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const PER_PAGE = 25
const emptyFilters = { search: "", action: "", user: "", from: "", to: "", result: "", platform: "" }

// the action filter (ACTIONS in backend/audit_logs.py)
const ACTIONS = [
  { value: "login_success", label: "Signed in" },
  { value: "login_failed", label: "Failed sign-in" },
  { value: "logout", label: "Signed out" },
  { value: "view", label: "Viewed" },
  { value: "export", label: "Exported" },
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
  { value: "data", label: "Data changes only" },
]
const RESULTS = [
  { value: "success", label: "Successful" },
  { value: "failed", label: "Failed" },
]
const PLATFORMS = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile app" },
]

const TABLE_LABELS = { users: "Account", farmers: "Farmer", mobile_scans: "Scan" }

// why a sign-in failed (login_history.reason in the backend)
const REASONS = {
  wrong_password: "Wrong password",
  unknown_user: "No such account",
  deactivated: "Account deactivated",
}

const GREEN = "bg-green-600/15 text-green-700 dark:text-green-400"
const AMBER = "bg-amber-500/15 text-amber-700 dark:text-amber-400"
const BLUE = "bg-sky-500/15 text-sky-700 dark:text-sky-400"
const VIOLET = "bg-violet-500/15 text-violet-700 dark:text-violet-400"
const GRAY = "bg-muted text-muted-foreground"
const RED = "bg-destructive/15 text-destructive"

const DATA_BADGES = {
  INSERT: { label: "Added", className: GREEN },
  UPDATE: { label: "Changed", className: AMBER },
  DELETE: { label: "Deleted", className: RED },
}
// what kind of request it was, from the HTTP method
const METHOD_BADGES = {
  GET: { label: "Viewed", className: GRAY },
  POST: { label: "Created", className: BLUE },
  PUT: { label: "Updated", className: AMBER },
  PATCH: { label: "Updated", className: AMBER },
  DELETE: { label: "Deleted", className: RED },
  // backup.py and restore.py, run from the terminal
  BACKUP: { label: "Backup", className: GREEN },
  RESTORE: { label: "Restore", className: VIOLET },
}

// readable names for the columns the triggers copy
const FIELDS = {
  id: "ID",
  email: "Email",
  username: "Username",
  role: "Role",
  name: "Name",
  municipality: "Municipality",
  password: "Password",
  farmer_id: "Farmer ID",
  user_id: "Account ID",
  full_name: "Full name",
  farm_name: "Farm",
  farm_latitude: "Farm latitude",
  farm_longitude: "Farm longitude",
  farm_size_ha: "Farm size (ha)",
  is_active: "Active",
  scan_uuid: "Scan ID",
  saved_by: "Saved by (account ID)",
  saved_by_name: "Saved by",
  latitude: "Latitude",
  longitude: "Longitude",
  scanned_at: "Scanned (device time)",
  predicted_label: "Prediction",
  confidence: "Confidence",
  second_label: "Second guess",
  second_confidence: "Second confidence",
  image_source: "Image source",
  verified_label: "Verified as",
  verified_by: "Verified by",
  notes: "Notes",
  verified_at: "Verified",
  farmer_feedback: "Farmer feedback",
  farmer_label: "Farmer's label",
}

const fieldName = (key) => FIELDS[key] || key

function showValue(key, value) {
  if (value === null || value === undefined || value === "") return "–"
  if (key === "is_active") return value ? "Yes" : "No"
  if (key === "role") return getRoleLabel(value)
  if (key === "confidence" || key === "second_confidence") return `${(Number(value) * 100).toFixed(1)}%`
  return String(value)
}

// "Chrome on Windows", "PinePal app" ... from the user agent, good enough to tell devices apart
function deviceName(agent) {
  if (!agent) return null
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

const failed = (item) => item.action === "FAILED" || item.status_code >= 400
const isExport = (item) => item.category === "activity" && item.path?.startsWith("/api/scans/export")
// a list's or an export's filters, saved with the request (backend/activity_log.py)
const requestFilters = (item) => (item.category === "activity" && item.new_values?.filters) || null

// the picked day as the exact moment it starts on this computer, for the server (UTC)
function startOfDay(day, addDays = 0) {
  const moment = new Date(`${day}T00:00:00`)
  moment.setDate(moment.getDate() + addDays)
  return moment.toISOString()
}

function toQuery(filters) {
  const { from, to, ...rest } = filters
  return { ...rest, from: from ? startOfDay(from) : "", to: to ? startOfDay(to, 1) : "" }
}

// a short name for the record a data change was about
function recordName(change) {
  const values = change.new_values || change.old_values || {}
  if (change.table === "users")
    return values.name ? `${values.name}${values.username ? ` (${values.username})` : ""}` : `Account #${change.record_id}`
  if (change.table === "farmers") return values.full_name ? `${values.full_name} (${change.record_id})` : change.record_id
  return values.predicted_label
    ? `${values.predicted_label}${values.farm_name ? ` · ${values.farm_name}` : ""}`
    : `Scan ${change.record_id.slice(0, 8)}`
}

// where a record can still be opened (not after it was deleted)
function recordLink(change) {
  if (change.action === "DELETE") return null
  if (change.table === "mobile_scans") return `/scans/${change.record_id}`
  if (change.table === "farmers") return `/farmers/${encodeURIComponent(change.record_id)}`
  return null
}

function Who({ item }) {
  if (item.actor_name)
    return (
      <>
        <div className="font-medium">{item.actor_name}</div>
        <div className="text-xs text-muted-foreground">
          {item.actor_username}
          {item.actor_role && ` · ${getRoleLabel(item.actor_role)}`}
        </div>
      </>
    )
  if (item.actor_id) return <div className="text-muted-foreground">Deleted account #{item.actor_id}</div>
  if (item.actor_label) return <div>{item.actor_label}</div>
  // a sign-in with a username that matched no account
  if (item.category === "login")
    return (
      <>
        <div className="font-medium">{item.summary}</div>
        <div className="text-xs text-muted-foreground">No matching account</div>
      </>
    )
  if (item.category === "activity") return <div className="text-muted-foreground">Not signed in</div>
  return (
    <>
      <div className="text-muted-foreground">System</div>
      <div className="text-xs text-muted-foreground">Script or direct database change</div>
    </>
  )
}

function EventBadge({ item }) {
  let badge
  if (item.category === "login")
    badge =
      item.action === "LOGOUT"
        ? { label: "Signed out", className: GRAY }
        : failed(item)
          ? { label: "Failed sign-in", className: RED }
          : { label: "Signed in", className: GREEN }
  else if (item.category === "data") badge = DATA_BADGES[item.action]
  else if (isExport(item)) badge = { label: "Exported", className: VIOLET }
  else badge = METHOD_BADGES[item.action] || { label: item.action, className: GRAY }
  return <Badge className={badge.className}>{badge.label}</Badge>
}

function FilterList({ filters }) {
  return Object.entries(filters)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ")
}

// the main text of a row: what happened
function What({ item }) {
  if (item.category === "login") {
    const where = item.platform === "mobile" ? "the mobile app" : "the web"
    if (item.action === "LOGOUT") return <div>Signed out of {where}</div>
    const reason = item.new_values?.reason
    return (
      <>
        <div>Signed in on {where}</div>
        {failed(item) && reason && <div className="text-xs text-destructive">{REASONS[reason] || reason}</div>}
      </>
    )
  }
  if (item.category === "data") {
    return (
      <>
        <div className="text-xs text-muted-foreground">{TABLE_LABELS[item.table] || item.table}</div>
        <div className="font-medium">{recordName(item)}</div>
      </>
    )
  }
  const filters = requestFilters(item)
  return (
    <>
      <div>{item.summary}</div>
      {isExport(item) && filters && (
        <div className="text-xs text-muted-foreground">
          <FilterList filters={filters} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span className={failed(item) ? "font-medium text-destructive" : ""}>{item.status_code}</span>
        {item.duration_ms != null && <span>{item.duration_ms} ms</span>}
        {item.changes.length > 0 && (
          <span>
            {item.changes.length} {item.changes.length === 1 ? "change" : "changes"}
          </span>
        )}
      </div>
    </>
  )
}

function Where({ item }) {
  const device = deviceName(item.user_agent)
  if (!item.platform && !item.ip_address) return <span className="text-muted-foreground">–</span>
  const PlatformIcon = item.platform === "mobile" ? SmartphoneIcon : GlobeIcon
  return (
    <>
      {item.platform && (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <PlatformIcon className="size-3.5 text-muted-foreground" />
          {device || (item.platform === "mobile" ? "Mobile app" : "Web")}
        </span>
      )}
      {item.ip_address && <div className="text-xs text-muted-foreground tabular-nums">{item.ip_address}</div>}
    </>
  )
}

// one changed record: every field with its value before and after, side by side
function ChangeTable({ change }) {
  const before = change.old_values || {}
  const after = change.new_values || {}
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key}>
            <TableCell className="text-muted-foreground">{fieldName(key)}</TableCell>
            <TableCell className="whitespace-normal break-all">
              {key === "password" ? "–" : showValue(key, before[key])}
            </TableCell>
            <TableCell className={"whitespace-normal break-all " + (change.action !== "DELETE" ? "font-medium" : "")}>
              {key === "password" ? "Changed" : showValue(key, after[key])}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

// the popup for one row: everything about the event, and what it changed
function Details({ item }) {
  const changes = item.category === "data" ? [item] : item.changes
  const filters = requestFilters(item)
  const device = deviceName(item.user_agent)
  const link = item.category === "data" ? recordLink(item) : null
  return (
    <div className="space-y-4 text-sm">
      <dl className="space-y-1.5">
        <DetailRow label="When">{formatDateTime(item.created_at)}</DetailRow>
        <DetailRow label="Who">
          <Who item={item} />
        </DetailRow>
        <DetailRow label="Event">
          <EventBadge item={item} />
        </DetailRow>
        {item.category === "activity" && <DetailRow label="What">{item.summary}</DetailRow>}
        {item.category === "login" && item.action !== "LOGOUT" && (
          <DetailRow label="Typed">{item.summary}</DetailRow>
        )}
        {item.category === "login" && failed(item) && item.new_values?.reason && (
          <DetailRow label="Reason">{REASONS[item.new_values.reason] || item.new_values.reason}</DetailRow>
        )}
        {item.category === "data" && (
          <DetailRow label="Record">
            {TABLE_LABELS[item.table] || item.table}:{" "}
            {link ? (
              <Link to={link} className="font-medium hover:underline">
                {recordName(item)}
              </Link>
            ) : (
              recordName(item)
            )}
          </DetailRow>
        )}
        {item.platform && <DetailRow label="Source">{item.platform === "mobile" ? "Mobile app" : "Web"}</DetailRow>}
        {device && <DetailRow label="Device">{device}</DetailRow>}
        {item.ip_address && <DetailRow label="IP address">{item.ip_address}</DetailRow>}
        {item.path && (
          <DetailRow label="Request">
            <span className="font-mono text-xs">
              {item.action} {item.path}
            </span>
          </DetailRow>
        )}
        {item.status_code != null && (
          <DetailRow label="Result">
            <span className={failed(item) ? "font-medium text-destructive" : ""}>{item.status_code}</span>
            {item.duration_ms != null && <span className="text-muted-foreground"> · {item.duration_ms} ms</span>}
          </DetailRow>
        )}
        {filters && (
          <DetailRow label={isExport(item) ? "Export filters" : "Filters"}>
            <ul>
              {Object.entries(filters).map(([key, value]) => (
                <li key={key}>
                  <span className="text-muted-foreground">{key}:</span> {value}
                </li>
              ))}
            </ul>
          </DetailRow>
        )}
      </dl>

      {item.category === "activity" && changes.length === 0 && (
        <p className="text-muted-foreground">Nothing in the database changed.</p>
      )}
      {changes.map((change) => (
        <div key={change.id} className="rounded-md border">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <EventBadge item={change} />
            <span className="text-xs text-muted-foreground">{TABLE_LABELS[change.table] || change.table}</span>
            <span className="font-medium">{recordName(change)}</span>
          </div>
          <ChangeTable change={change} />
        </div>
      ))}
    </div>
  )
}

function Field({ label, children, className }) {
  return (
    <div className={"w-full sm:w-auto " + (className || "")}>
      <Label className="mb-1.5 text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

// Everything that happens in PinePal, newest first: every request (activity), every sign-in,
// sign-out and failed sign-in, and every change to accounts, farmers and scans (written by
// database triggers). Click a row for its details, with old and new values side by side.
// Admins only: the route and sidebar link are admin-only, and the server refuses everyone else.
function AuditLogs() {
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null) // the row shown in the popup

  useEffect(() => {
    getUsers()
      .then((list) =>
        setUsers(
          list
            .map((u) => ({ value: String(u.id), label: `${u.full_name || u.name} (${u.username})` }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch((err) => console.error(err)) // the user filter just stays empty
  }, [])

  useEffect(() => {
    let ignore = false
    getAuditLogs({ ...toQuery(filters), page, per_page: PER_PAGE })
      .then((result) => {
        if (ignore) return
        setData(result)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load the audit logs.")
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
        title="Audit logs"
        description="Everything that happens in PinePal: every action, sign-in and sign-out, and every change to accounts, farmers and scans. Entries can't be edited or deleted."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-48 grow">
            <Input
              placeholder="Who, what, or a record ID"
              value={filters.search}
              onChange={(e) => changeFilter("search", e.target.value)}
            />
          </Field>
          <Field label="User">
            <SelectField
              className="w-full sm:w-48"
              allLabel="Everyone"
              value={filters.user}
              onChange={(v) => changeFilter("user", v)}
              options={users}
            />
          </Field>
          <Field label="Action">
            <SelectField
              className="w-full sm:w-40"
              allLabel="All actions"
              value={filters.action}
              onChange={(v) => changeFilter("action", v)}
              options={ACTIONS}
            />
          </Field>
          <Field label="From">
            <Input
              type="date"
              className="w-full sm:w-38"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => changeFilter("from", e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              className="w-full sm:w-38"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => changeFilter("to", e.target.value)}
            />
          </Field>
          <Field label="Result">
            <SelectField
              className="w-full sm:w-32"
              allLabel="All results"
              value={filters.result}
              onChange={(v) => changeFilter("result", v)}
              options={RESULTS}
            />
          </Field>
          <Field label="Source">
            <SelectField
              className="w-full sm:w-32"
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
        <LoadingBlocks rows={8} height="h-10" label="Loading the audit logs" />
      ) : !error && data.items.length === 0 ? (
        <EmptyState icon={ScrollTextIcon} title="Nothing to show" text="Nothing matches these filters yet." />
      ) : (
        !error && (
          <>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead>Where</TableHead>
                    <TableHead className="w-8">
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className={"cursor-pointer align-top " + (failed(item) ? "bg-destructive/5" : "")}
                      onClick={() => setSelected(item)}
                    >
                      <TableCell className="whitespace-nowrap">{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>
                        <Who item={item} />
                      </TableCell>
                      <TableCell>
                        <EventBadge item={item} />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <What item={item} />
                      </TableCell>
                      <TableCell>
                        <Where item={item} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Show details"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(item)
                          }}
                        >
                          <ChevronRightIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Pagination page={page} perPage={PER_PAGE} total={data.total} onChange={setPage} />
          </>
        )
      )}

      <Modal open={!!selected} title="Audit log details" onClose={() => setSelected(null)}>
        {selected && <Details item={selected} />}
      </Modal>
    </div>
  )
}

export default AuditLogs
