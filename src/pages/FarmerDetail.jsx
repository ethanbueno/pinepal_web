import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getFarmer } from "../api/farmers"
import { getScans } from "../api/scans"
import ScansTable from "../components/ScansTable"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate } from "../utils/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function Info({ label, children }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function FarmerDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  // admins reach farmers from the Farmers tab on the Users page
  const backTo = user.role === "admin" ? "/users?tab=farmers" : "/farmers"
  const [farmer, setFarmer] = useState(null)
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false

    Promise.all([getFarmer(id), getScans({ farmer_id: id, per_page: 100 })])
      .then(([farmerData, scanData]) => {
        if (ignore) return
        setFarmer(farmerData)
        setScans(scanData.items)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError(err.response?.status === 404 ? "Farmer not found." : "Could not load this farmer.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id])

  if (loading) return <p className="text-muted-foreground">Loading farmer...</p>
  if (error) {
    return (
      <div>
        <ErrorAlert>{error}</ErrorAlert>
        <Link to={backTo} className="font-semibold underline underline-offset-4">Back to farmers</Link>
      </div>
    )
  }

  // the farm itself plus a dot for each scan
  const points = [
    { id: "farm", lat: farmer.farm_latitude, lng: farmer.farm_longitude, color: "#141413", text: farmer.farm_name },
    ...scans.map((s) => {
      const disease = getDisease(s.verified_label || s.predicted_label)
      return { id: s.scan_uuid, lat: s.latitude, lng: s.longitude, color: disease.color, text: disease.name }
    }),
  ]

  return (
    <div>
      <Link to={backTo} className="font-semibold underline underline-offset-4 text-sm">← Back to farmers</Link>
      <h1 className="text-2xl font-medium mb-4">{farmer.full_name}</h1>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Farm">{farmer.farm_name}</Info>
              <Info label="Municipality">{farmer.municipality}</Info>
              <Info label="Farm size">{farmer.farm_size_ha ? `${farmer.farm_size_ha} ha` : "-"}</Info>
              <Info label="Username">{farmer.username ? `@${farmer.username}` : "No login yet"}</Info>
              <Info label="Registered">{formatDate(farmer.registered_at)}</Info>
              <Info label="Status">
                <Badge variant={farmer.is_active ? "default" : "secondary"}>
                  {farmer.is_active ? "Active" : "Inactive"}
                </Badge>
              </Info>
            </div>

            <h2 className="font-semibold mt-5 mb-2">Scans by disease ({farmer.total_scans} total)</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {DISEASES.map((d) => {
                const row = farmer.scans_by_disease.find((r) => r.label === d.label)
                return (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="grow">{d.name}</span>
                    <span className="text-muted-foreground">{row ? row.count : 0}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <MiniMap height={300} center={[farmer.farm_latitude, farmer.farm_longitude]} zoom={12} points={points} />
      </div>

      <h2 className="font-semibold mb-3">Scans</h2>
      <ScansTable scans={scans} />
    </div>
  )
}

export default FarmerDetail
