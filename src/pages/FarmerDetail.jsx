import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getFarmer } from "../api/farmers"
import { getScans } from "../api/scans"
import ScansTable from "../components/ScansTable"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import BackButton from "../components/BackButton"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import Pagination from "../components/Pagination"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate } from "../utils/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function Info({ label, children }) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  )
}

const PER_PAGE = 10

function FarmerDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  // admins reach farmers from the Farmers tab on the Users page
  const backTo = user.role === "admin" ? "/users?tab=farmers" : "/farmers"
  const [farmer, setFarmer] = useState(null)
  const [scans, setScans] = useState([])
  const [page, setPage] = useState(1)
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

  if (loading) return <LoadingBlocks rows={3} height="h-40" label="Loading farmer" />
  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <ErrorAlert className="">{error}</ErrorAlert>
        <BackButton to={backTo}>Back to Farmers</BackButton>
      </div>
    )
  }

  // the farm itself plus a dot for each scan. A farmer who signed up has no farm pin
  // until their first sync.
  const hasPin = farmer.farm_latitude != null
  const points = [
    ...(hasPin
      ? [{ id: "farm", lat: farmer.farm_latitude, lng: farmer.farm_longitude, color: "#141413", text: farmer.farm_name }]
      : []),
    ...scans.map((s) => {
      const disease = getDisease(s.verified_label || s.predicted_label)
      return { id: s.scan_uuid, lat: s.latitude, lng: s.longitude, color: disease.color, text: disease.name }
    }),
  ]

  return (
    <div>
      <div className="mb-4">
        <BackButton to={backTo}>Back to Farmers</BackButton>
      </div>
      <PageHeader
        title={farmer.full_name}
        description={farmer.farm_name ? `${farmer.farm_name} · ${farmer.municipality}` : farmer.municipality}
      />

      {/* the two cards stretch to the same height */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Farmer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Farm">{farmer.farm_name || "–"}</Info>
              <Info label="Municipality">{farmer.municipality}</Info>
              <Info label="Farm Size">{farmer.farm_size_ha ? `${farmer.farm_size_ha} ha` : "-"}</Info>
              <Info label="Username">{farmer.username ? `@${farmer.username}` : "No login yet"}</Info>
              <Info label="Registered">{formatDate(farmer.registered_at)}</Info>
              <Info label="Status">
                <Badge variant={farmer.is_active ? "default" : "secondary"}>
                  {farmer.is_active ? "Active" : "Inactive"}
                </Badge>
              </Info>
            </div>

            <h2 className="mt-6 mb-3 border-t pt-4 text-sm font-semibold">
              Scans by disease <span className="font-normal text-muted-foreground">({farmer.total_scans} total)</span>
            </h2>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {DISEASES.map((d) => {
                const row = farmer.scans_by_disease.find((r) => r.label === d.label)
                return (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="grow">{d.name}</span>
                    <span className="font-medium tabular-nums">{row ? row.count : 0}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Where They Scanned</CardTitle>
          </CardHeader>
          {/* grows to the height of the card next to it, never shorter than 16rem */}
          <CardContent className="relative min-h-64 flex-1">
            <div className="absolute inset-y-0 right-(--card-spacing) left-(--card-spacing)">
              <MiniMap
                height="100%"
                center={hasPin ? [farmer.farm_latitude, farmer.farm_longitude] : undefined}
                zoom={hasPin ? 12 : undefined}
                points={points}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* every scan here is this farmer's, so no Farmer column; a page at a time */}
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Scans</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ScansTable
            scans={scans.slice((page - 1) * PER_PAGE, page * PER_PAGE)}
            showFarmer={false}
            bare
            emptyText="This farmer has no scans yet."
          />
        </CardContent>
      </Card>
      <Pagination page={page} perPage={PER_PAGE} total={scans.length} onChange={setPage} />
    </div>
  )
}

export default FarmerDetail
