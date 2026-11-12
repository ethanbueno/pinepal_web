import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyFarmer, getFarmer } from "../api/farmers"
import { getScans } from "../api/scans"
import StatCard from "../components/StatCard"
import ScansTable from "../components/ScansTable"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import EmptyState from "../components/EmptyState"
import { UnlinkIcon } from "lucide-react"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate } from "../utils/format"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function FarmerHome() {
  const { user } = useAuth()
  const [farmer, setFarmer] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false

    getMyFarmer(user)
      .then((me) => {
        if (!me) return null // account is not linked to a farm
        return Promise.all([getFarmer(me.farmer_id), getScans({ farmer_id: me.farmer_id, per_page: 100 })])
      })
      .then((result) => {
        if (ignore) return
        if (result) {
          setFarmer(result[0])
          setRecent(result[1].items)
        }
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load your farm.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [user])

  if (loading) return <LoadingBlocks rows={3} height="h-32" label="Loading your farm" />
  if (error) return <ErrorAlert>{error}</ErrorAlert>

  if (!farmer) {
    return (
      <div>
        <PageHeader title={`Welcome, ${user.full_name}`} />
        <EmptyState
          icon={UnlinkIcon}
          title="Not linked to a farm yet"
          text="Your account is not linked to a farm yet. Please ask an agricultural officer to add you on the Farmers page."
        />
      </div>
    )
  }

  const countOf = (label) => {
    const row = farmer.scans_by_disease.find((r) => r.label === label)
    return row ? row.count : 0
  }
  const healthy = countOf("No_Disease")
  const diseased = farmer.total_scans - healthy

  const points = recent.map((s) => {
    const disease = getDisease(s.verified_label || s.predicted_label)
    return { id: s.scan_uuid, lat: s.latitude, lng: s.longitude, color: disease.color, text: disease.name }
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Welcome, ${user.full_name}`}
        description={
          farmer.farm_name
            ? `${farmer.farm_name} · ${farmer.municipality}${farmer.farm_size_ha ? ` · ${farmer.farm_size_ha} ha` : ""}`
            : "Your farm details are filled in from your first synced scan."
        }
      />

      {/* every card has a note, so the three line up */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="My Scans"
          value={farmer.total_scans}
          note={recent.length > 0 ? `Last scan ${formatDate(recent[0].scanned_at)}.` : "No scans yet."}
        />
        <StatCard title="Diseased" value={diseased} note="Scans with a problem." />
        <StatCard title="Healthy" value={healthy} note="No disease found." />
      </div>

      {/* the two cards stretch to the same height */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">My scans by disease</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {DISEASES.map((d) => (
              <div key={d.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-medium tabular-nums">{countOf(d.label)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: farmer.total_scans ? (countOf(d.label) / farmer.total_scans) * 100 + "%" : "0%",
                      backgroundColor: d.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Where I scanned</CardTitle>
          </CardHeader>
          {/* grows to the height of the card next to it, never shorter than 16rem */}
          <CardContent className="relative min-h-64 flex-1">
            {/* absolute, so the map always has a real height to fill (phones included) */}
            <div className="absolute inset-y-0 right-(--card-spacing) left-(--card-spacing)">
              <MiniMap
                height="100%"
                center={farmer.farm_latitude != null ? [farmer.farm_latitude, farmer.farm_longitude] : undefined}
                zoom={farmer.farm_latitude != null ? 12 : undefined}
                points={points}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Latest scans</CardTitle>
          <CardAction>
            <Link
              to="/my-scans"
              className="rounded-sm text-sm font-medium underline underline-offset-4 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              See all history
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <ScansTable
            scans={recent.slice(0, 5)}
            showFarmer={false}
            showMunicipality={false}
            bare
            emptyText="No scans yet. Scans you take with the app or on the Scan page will appear here."
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default FarmerHome
