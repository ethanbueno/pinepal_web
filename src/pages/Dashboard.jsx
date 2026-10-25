import { useEffect, useState } from "react"
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts"
import { getStats } from "../api/stats"
import StatCard from "../components/StatCard"
import ScansTable from "../components/ScansTable"
import ErrorAlert from "../components/ErrorAlert"
import { DISEASES, LOW_CONFIDENCE, getDisease } from "../utils/diseases"
import { formatPercent } from "../utils/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
const barConfig = { count: { label: "Cases" } }

// "2026-09" -> "Sep 2026" (same style as dates everywhere else)
const monthName = (month) =>
  new Date(month + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })

// The card is about the newest month that has scans, so it never shows a confusing 0.
function monthCardTitle(latestMonth) {
  if (!latestMonth) return "Scans This Month"
  const current = new Date().toISOString().slice(0, 7)
  return latestMonth === current ? "Scans This Month" : "Scans in " + monthName(latestMonth)
}

function Dashboard() {
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

  if (loading) return <p className="text-muted-foreground">Loading dashboard...</p>
  if (error) return <ErrorAlert>{error}</ErrorAlert>

  const barData = stats.by_disease.map((row) => ({
    name: getDisease(row.label).name,
    count: row.count,
    color: getDisease(row.label).color,
  }))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Disease counts use the verified diagnosis when there is one, otherwise the prediction.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="mb-1.5">From</Label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5">To</Label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard title="Total Scans" value={stats.total_scans} />
        <StatCard title={monthCardTitle(stats.latest_month)} value={stats.scans_this_month} note="most recent month with scans" />
        <StatCard title="Diseased" value={formatPercent(stats.diseased_pct)} note="of all scans" />
        <StatCard title="Needs Review" value={stats.needs_review} note={`unverified, under ${Math.round(LOW_CONFIDENCE * 100)}% confidence`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Cases per month</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.by_month.length === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">No scans yet. The chart will appear here.</p>
            ) : (
              <ChartContainer config={lineConfig} className="aspect-auto h-[280px] w-full">
                <LineChart data={stats.by_month}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={monthName} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {DISEASES.map((d) => (
                    <Line key={d.label} type="monotone" dataKey={d.label} stroke={`var(--color-${d.label})`} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Total cases per disease</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.total_scans === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">No scans yet. The chart will appear here.</p>
            ) : (
              <ChartContainer config={barConfig} className="aspect-auto h-[280px] w-full">
                <BarChart data={barData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={4}>
                    {barData.map((row) => (
                      <Cell key={row.name} fill={row.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1 self-start">
          <CardHeader>
            <CardTitle className="font-semibold">Top municipalities</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Municipality</TableHead>
                <TableHead>Diseased</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.by_municipality.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className=" text-center text-muted-foreground">No data yet.</TableCell>
                </TableRow>
              )}
              {stats.by_municipality.slice(0, 5).map((row) => (
                <TableRow key={row.municipality} className=" hover:bg-muted">
                  <TableCell>{row.municipality}</TableCell>
                  <TableCell>{row.diseased}</TableCell>
                  <TableCell>{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="xl:col-span-2">
          <h2 className="font-semibold mb-3">Recent scans</h2>
          <ScansTable scans={stats.recent} />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
