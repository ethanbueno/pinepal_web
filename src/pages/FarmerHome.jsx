import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyFarmer, getFarmer } from "../api/farmers"
import { getScans } from "../api/scans"
import StatCard from "../components/StatCard"
import ScansTable from "../components/ScansTable"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate } from "../utils/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  if (loading) return <p className="text-muted-foreground">Loading your farm...</p>
  if (error) return <ErrorAlert>{error}</ErrorAlert>

  if (!farmer) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl font-medium">Welcome, {user.full_name}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Your account is not linked to a farm yet. Please ask an agricultural officer to add you on
          the Farmers page.
        </CardContent>
      </Card>
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
    <div>
      <h1 className="text-2xl font-medium">Welcome, {user.full_name}</h1>
      <p className="text-muted-foreground mb-5">
        {farmer.farm_name} · {farmer.municipality} · {farmer.farm_size_ha} ha
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="My Scans" value={farmer.total_scans} />
        <StatCard title="Diseased" value={diseased} note="scans with a problem" />
        <StatCard title="Healthy" value={healthy} note="no disease found" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">My scans by disease</CardTitle>
          </CardHeader>
          <CardContent>
            {DISEASES.map((d) => (
              <div key={d.label} className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>{d.name}</span>
                  <span className="text-muted-foreground">{countOf(d.label)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
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

        <MiniMap height={300} center={[farmer.farm_latitude, farmer.farm_longitude]} zoom={12} points={points} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Latest scans</h2>
        <Link to="/my-scans" className="font-semibold underline underline-offset-4 text-sm">See all history →</Link>
      </div>
      <ScansTable scans={recent.slice(0, 5)} showFarmer={false} />
      {recent.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">Last scan: {formatDate(recent[0].scanned_at)}</p>
      )}
    </div>
  )
}

export default FarmerHome
