import { useEffect, useState } from "react"
import DatePicker from "../components/DatePicker"
import SelectField from "../components/SelectField"
import { Link, useNavigate } from "react-router-dom"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { CheckIcon, SearchXIcon } from "lucide-react"
import { getStats } from "../api/stats"
import { cachedGet } from "../api/cache"
import StatCard from "../components/StatCard"
import DiseaseBadge from "../components/DiseaseBadge"
import ErrorAlert from "../components/ErrorAlert"
import { DISEASES, HIGH_CONFIDENCE, LOW_CONFIDENCE, getDisease } from "../utils/diseases"
import { formatDate, formatPercent } from "../utils/format"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import LoadingBlocks from "../components/LoadingBlocks"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

// one chart color per disease, used by the line chart
const lineConfig = Object.fromEntries(DISEASES.map((d) => [d.label, { label: d.name, color: d.color }]))

// "2026-09" -> "Sep 2026" (same style as dates everywhere else)
const monthName = (month) =>
  new Date(month + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })

// The card is about the newest month that has scans, so it never shows a confusing 0.
function monthCardTitle(latestMonth) {
  if (!latestMonth) return "Scans This Month"
  const current = new Date().toISOString().slice(0, 7)
  return latestMonth === current ? "Scans This Month" : "Scans in " + monthName(latestMonth)
}

// quick date ranges, counted back from today ("all" = no limit)
// (short is the label on phones, where the full ones don't fit in one row)
const PRESETS = [
  { value: "3m", label: "Last 3 months", months: 3 },
  { value: "6m", label: "Last 6 months", months: 6 },
  { value: "12m", label: "Last 12 months", months: 12 },
  { value: "all", label: "All time", months: 0 },
]

const pad = (n) => String(n).padStart(2, "0")
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function presetRange(value) {
  const preset = PRESETS.find((p) => p.value === value)
  if (!preset || !preset.months) return { from: "", to: "" }
  const d = new Date()
  d.setMonth(d.getMonth() - preset.months)
  return { from: isoDate(d), to: "" }
}

function rangeLabel({ from, to }) {
  if (!from && !to) return "Showing all scans"
  const start = from ? formatDate(from + "T00:00:00") : "the first scan"
  const end = to ? formatDate(to + "T00:00:00") : "today"
  return `Showing scans from ${start} to ${end}`
}

// how many scans each confidence list shows (DASHBOARD_SCANS in backend/mobile_scans.py)
const DASHBOARD_SCANS = 5
const percent = (value) => Math.round(value * 100) + "%"

const linkClass =
  "rounded-sm text-sm font-medium underline underline-offset-4 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"

// The table's first and last cells line up with the card title and the links above them
// (the card's own padding), so every left and right edge in the card is the same
const EDGE = "first:pl-(--card-spacing) last:pr-(--card-spacing)"
// Every scan here is from Echague, so there is no Municipality column
const COLUMNS = ["Date", "Farmer", "Predicted", "Confidence", "Source"]

// One group of the Scans card: a heading row, then its scans.
// showVerified = tag the verified ones next to the diagnosis (the lowest confidence group only;
// the unverified ones there are tinted red instead).
function ScanGroup({ title, note, scans, emptyText, showVerified }) {
  const navigate = useNavigate()
  return (
    <TableBody className="[&_tr:last-child]:border-b">
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={COLUMNS.length} className="px-(--card-spacing) py-2.5 whitespace-normal">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{note}</div>
        </TableCell>
      </TableRow>
      {scans.length === 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMNS.length} className="px-(--card-spacing) py-4 text-center text-muted-foreground">
            {emptyText}
          </TableCell>
        </TableRow>
      )}
      {scans.map((scan) => (
        <TableRow
          key={scan.scan_uuid}
          onClick={() => navigate("/scans/" + scan.scan_uuid, { state: { from: "/" } })}
          className={
            "cursor-pointer " +
            (!scan.verified_label && scan.confidence < LOW_CONFIDENCE ? "bg-destructive/10 hover:bg-destructive/15" : "")
          }
        >
          <TableCell className={EDGE}>{formatDate(scan.scanned_at)}</TableCell>
          <TableCell className={EDGE}>{scan.farmer_name}</TableCell>
          <TableCell className={EDGE}>
            <span className="flex items-center gap-2">
              <DiseaseBadge label={scan.predicted_label} />
              {showVerified && scan.verified_label && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckIcon className="size-3.5" /> Verified
                </span>
              )}
            </span>
          </TableCell>
          <TableCell className={EDGE + " tabular-nums"}>{formatPercent(scan.confidence)}</TableCell>
          <TableCell className={EDGE}>{scan.image_source}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}

// a number's share of a total, as a whole percent for text and a width for bars
const share = (count, total) => (total > 0 ? count / total : 0)

// One row of a breakdown list: a name, its numbers on the right and a thin bar under it
function ShareRow({ name, dotColor, count, detail, fraction, barColor, barClass }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {dotColor && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
          <span className="truncate">{name}</span>
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{count}</span> {detail}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={"h-full rounded-full " + (barClass || "")}
          style={{ width: `${fraction * 100}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

function Dashboard() {
  const [preset, setPreset] = useState("all")
  const [range, setRange] = useState({ from: "", to: "" })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // load again whenever the date range changes
  useEffect(() => {
    let ignore = false

    cachedGet(["stats", range], () => getStats(range), (data) => {
      if (ignore) return
      setStats(data)
      setError("")
      setLoading(false)
    })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load the dashboard.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [range])

  const choosePreset = (value) => {
    setPreset(value)
    setRange(presetRange(value))
  }

  const changeDate = (name, value) => {
    setPreset("custom")
    setRange({ ...range, [name]: value })
  }

  // the title and date filters stay on screen in every state, so a new range can always be picked
  const header = (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {rangeLabel(range)}. Disease counts use the verified diagnosis when there is one, otherwise the prediction.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44">
          <Label className="mb-1.5 text-muted-foreground">Range</Label>
          <SelectField
            value={preset}
            onChange={(value) => value !== "custom" && choosePreset(value)}
            options={[
              ...PRESETS.map((p) => ({ value: p.value, label: p.label })),
              // shown once dates are picked by hand
              ...(preset === "custom" ? [{ value: "custom", label: "Custom range" }] : []),
            ]}
          />
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <div className="min-w-0">
            <Label htmlFor="from-date" className="mb-1.5 text-muted-foreground">
              From
            </Label>
            <DatePicker
              id="from-date"
              value={range.from}
              onChange={(value) => changeDate("from", value)}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="to-date" className="mb-1.5 text-muted-foreground">
              To
            </Label>
            <DatePicker id="to-date" value={range.to} onChange={(value) => changeDate("to", value)} />
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <LoadingBlocks rows={4} height="h-32" label="Loading dashboard" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorAlert className="">
          {error} Check that the server is running, then pick a date range to try again.
        </ErrorAlert>
      </div>
    )
  }

  const total = stats.total_scans
  const healthy = stats.by_disease.find((d) => d.label === "No_Disease")?.count ?? 0
  const diseaseRows = [...stats.by_disease].sort((a, b) => b.count - a.count)

  return (
    <div className="flex flex-col gap-4">
      {header}

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <SearchXIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">No scans in this date range</p>
            <p className="text-sm text-muted-foreground">Try a wider range, or choose All time.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* the numbers that matter, with the one that needs action first to catch the eye */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Needs Review"
              value={stats.needs_review}
              note={`Unverified and under ${Math.round(LOW_CONFIDENCE * 100)}% confidence. Click to review.`}
              to="/scans"
              state={{ filters: { verified: "no", low_conf: true } }}
              tone="warning"
            />
            <StatCard title="Total Scans" value={total} note="Click to see them all." to="/scans" />
            <StatCard
              title="Diseased"
              value={formatPercent(stats.diseased_pct)}
              note={`${total - healthy} of ${total} scans have a disease.`}
            />
            <StatCard
              title={monthCardTitle(stats.latest_month)}
              value={stats.scans_this_month}
              note="The most recent month with scans."
            />
          </div>

          {/* the trend over time, next to which diseases are the biggest problem */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="font-semibold">Cases per month</CardTitle>
                <CardDescription>Scans by diagnosis, month by month.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={lineConfig} className="aspect-auto h-[240px] w-full">
                  <LineChart data={stats.by_month}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={monthName} />} />
                    <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
                    {DISEASES.map((d) => (
                      <Line
                        key={d.label}
                        type="monotone"
                        dataKey={d.label}
                        stroke={`var(--color-${d.label})`}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Disease breakdown</CardTitle>
                <CardDescription>Share of all scans in this range.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {diseaseRows.map((row) => {
                  const disease = getDisease(row.label)
                  const fraction = share(row.count, total)
                  return (
                    <ShareRow
                      key={row.label}
                      name={disease.name}
                      dotColor={disease.color}
                      count={row.count}
                      detail={"· " + formatPercent(fraction)}
                      fraction={fraction}
                      barColor={disease.color}
                    />
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* the surest and least sure scans (no municipality ranking: PinePal covers Echague only) */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Scans</CardTitle>
                <CardDescription>
                  Up to {DASHBOARD_SCANS} of the most and least confident Echague scans in this range.
                </CardDescription>
                <CardAction>
                  <Link to="/scans" className={linkClass}>
                    View all scans
                  </Link>
                </CardAction>
              </CardHeader>
              {/* one table for both groups, so their columns line up */}
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {COLUMNS.map((column) => (
                        <TableHead key={column} className={EDGE}>
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <ScanGroup
                    title="Highest confidence"
                    note={`${percent(HIGH_CONFIDENCE)} confidence and above, most confident first.`}
                    scans={stats.highest_confidence}
                    emptyText={`No scans at ${percent(HIGH_CONFIDENCE)} confidence or above in this range.`}
                    showVerified={false}
                  />
                  <ScanGroup
                    title="Lowest confidence"
                    note={`Under ${percent(LOW_CONFIDENCE)} confidence, least confident first. Red rows are not verified yet.`}
                    scans={stats.lowest_confidence}
                    emptyText={`No scans under ${percent(LOW_CONFIDENCE)} confidence in this range.`}
                    showVerified
                  />
                </Table>
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
