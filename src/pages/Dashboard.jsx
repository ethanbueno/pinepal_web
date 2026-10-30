import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { getStats } from "../api/stats"
import StatCard from "../components/StatCard"
import ScansTable from "../components/ScansTable"
import ErrorAlert from "../components/ErrorAlert"
import { DISEASES, LOW_CONFIDENCE, getDisease } from "../utils/diseases"
import { formatDate, formatPercent } from "../utils/format"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

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

// a number's share of a total, as a whole percent for text and a width for bars
const share = (count, total) => (total > 0 ? count / total : 0)

function Dashboard() {
  const [preset, setPreset] = useState("all")
  const [range, setRange] = useState({ from: "", to: "" })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // load again whenever the date range changes
  useEffect(() => {
    let ignore = false

    getStats(range)
      .then((data) => {
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

  if (loading) return <p className="text-muted-foreground">Loading dashboard...</p>
  if (error) return <ErrorAlert>{error}</ErrorAlert>

  const total = stats.total_scans
  const healthy = stats.by_disease.find((d) => d.label === "No_Disease")?.count ?? 0
  const diseaseRows = [...stats.by_disease].sort((a, b) => b.count - a.count)
  const topMunicipalities = stats.by_municipality.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      {/* 1. what you are looking at, and how to change it */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel(range)}. Disease counts use the verified diagnosis when there is one, otherwise the prediction.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[preset]}
            onValueChange={(value) => value[0] && choosePreset(value[0])}
          >
            {PRESETS.map((p) => (
              <ToggleGroupItem key={p.value} value={p.value} className="px-3">
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div>
            <Label className="mb-1.5">From</Label>
            <Input type="date" value={range.from} onChange={(e) => changeDate("from", e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5">To</Label>
            <Input type="date" value={range.to} onChange={(e) => changeDate("to", e.target.value)} />
          </div>
        </div>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No scans in this date range. Try a wider range, or choose All time.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2. the numbers that matter, with the one that needs action first to catch the eye */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Needs Review"
              value={stats.needs_review}
              note={`unverified, under ${Math.round(LOW_CONFIDENCE * 100)}% confidence. Click to review`}
              to="/scans"
              state={{ filters: { verified: "no", low_conf: true } }}
              tone="warning"
            />
            <StatCard title="Total Scans" value={total} note="click to see them all" to="/scans" />
            <StatCard
              title="Diseased"
              value={formatPercent(stats.diseased_pct)}
              note={`${total - healthy} of ${total} scans have a disease`}
            />
            <StatCard
              title={monthCardTitle(stats.latest_month)}
              value={stats.scans_this_month}
              note="most recent month with scans"
            />
          </div>

          {/* 3. the trend over time, next to which diseases are the biggest problem */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="font-semibold">Cases per month</CardTitle>
                <p className="text-xs text-muted-foreground">Scans by diagnosis, month by month.</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={lineConfig} className="aspect-auto h-[300px] w-full">
                  <LineChart data={stats.by_month}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={monthName} />} />
                    <ChartLegend content={<ChartLegendContent />} />
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
                <p className="text-xs text-muted-foreground">Share of all scans in this range.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {diseaseRows.map((row) => {
                  const disease = getDisease(row.label)
                  const fraction = share(row.count, total)
                  return (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: disease.color }} />
                          {disease.name}
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{row.count}</span> · {formatPercent(fraction)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${fraction * 100}%`, backgroundColor: disease.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* 4. the latest activity, next to where the disease is */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="font-semibold">Recent scans</CardTitle>
                <p className="text-xs text-muted-foreground">The 8 newest scans in this range.</p>
                <CardAction>
                  <Link to="/scans" className="text-sm font-medium underline underline-offset-4">
                    View all scans
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                <ScansTable scans={stats.recent} bare />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Top municipalities</CardTitle>
                <p className="text-xs text-muted-foreground">Ranked by number of scans with a disease.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {topMunicipalities.map((row) => {
                  const rate = share(row.diseased, row.total)
                  return (
                    <div key={row.municipality ?? "unknown"}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{row.municipality || "Unknown"}</span>
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{row.diseased}</span> of {row.total} ·{" "}
                          {formatPercent(rate)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-destructive/70" style={{ width: `${rate * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
