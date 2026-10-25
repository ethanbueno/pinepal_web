import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import { getMapScans } from "../api/scans"
import { DISEASES, LOCKED_MUNICIPALITY, MUNICIPALITIES, getDisease } from "../utils/diseases"
import { viewBounds, viewMaxBounds } from "../utils/mapArea"
import IsabelaLayer from "../components/IsabelaLayer"
import ErrorAlert from "../components/ErrorAlert"
import SelectField, { toOptions } from "../components/SelectField"
import { formatDate, formatPercent, scanImage } from "../utils/format"
import { Card, CardContent } from "@/components/ui/card"
import { Toggle } from "@/components/ui/toggle"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function DiseaseMap() {
  const [selected, setSelected] = useState([]) // empty = show all diseases
  const [municipality, setMunicipality] = useState(LOCKED_MUNICIPALITY)
  const [range, setRange] = useState({ from: "", to: "" })
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false

    getMapScans({ diseases: selected, municipality, ...range })
      .then((data) => {
        if (ignore) return
        setScans(data)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load the map data.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [selected, municipality, range])

  const toggleDisease = (label) => {
    if (selected.includes(label)) {
      setSelected(selected.filter((l) => l !== label))
    } else {
      setSelected([...selected, label])
    }
  }

  const finalLabel = (scan) => scan.verified_label || scan.predicted_label
  const countOf = (label) => scans.filter((s) => finalLabel(s) === label).length

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 6rem)" }}>
      <div className="mb-3">
        <h1 className="text-2xl font-medium">Disease Map</h1>
        {LOCKED_MUNICIPALITY && (
          <p className="text-sm text-muted-foreground">Temporarily locked to {LOCKED_MUNICIPALITY}.</p>
        )}
      </div>

      <Card className="mb-3">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Diseases</Label>
            <div className="flex flex-wrap gap-2">
              {DISEASES.map((d) => (
                <Toggle
                  key={d.label}
                  variant="outline"
                  size="sm"
                  pressed={selected.includes(d.label)}
                  onPressedChange={() => toggleDisease(d.label)}
                  className="gap-2 data-pressed:border-primary data-pressed:bg-primary/10"
                >
                  <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </Toggle>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex w-44 flex-col gap-1.5">
              <Label>Municipality</Label>
              <SelectField
                allLabel={LOCKED_MUNICIPALITY ? undefined : "All (Isabela)"}
                value={municipality}
                onChange={setMunicipality}
                options={toOptions(LOCKED_MUNICIPALITY ? [LOCKED_MUNICIPALITY] : MUNICIPALITIES)}
                disabled={Boolean(LOCKED_MUNICIPALITY)}
              />
            </div>
            <div className="flex w-40 flex-col gap-1.5">
              <Label>From</Label>
              <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </div>
            <div className="flex w-40 flex-col gap-1.5">
              <Label>To</Label>
              <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Card className="relative isolate z-0 grow min-h-80 py-0">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-card/70 text-muted-foreground">
            Loading map...
          </div>
        )}

        <MapContainer
          bounds={viewBounds}
          maxBounds={viewMaxBounds}
          maxBoundsViscosity={1}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <IsabelaLayer selected={municipality} onSelect={setMunicipality} scans={scans} />
          {scans.map((scan) => {
            const disease = getDisease(finalLabel(scan))
            return (
              <CircleMarker
                key={scan.scan_uuid}
                center={[scan.latitude, scan.longitude]}
                radius={8}
                pathOptions={{ color: disease.color, fillColor: disease.color, fillOpacity: 0.7 }}
              >
                <Popup>
                  <div className="w-44">
                    <img src={scanImage(scan)} alt="Scan" className="w-full rounded mb-2" />
                    <div className="font-semibold">{disease.name}</div>
                    <div className="text-xs">Confidence: {formatPercent(scan.confidence)}</div>
                    <div className="text-xs">{formatDate(scan.scanned_at)}</div>
                    <div className="text-xs mb-1">{scan.farmer_name}</div>
                    <Link to={"/scans/" + scan.scan_uuid} state={{ from: "/map" }} className="font-semibold underline underline-offset-4 text-xs">
                      View details
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

        <Card size="sm" className="absolute top-4 right-4 z-[1000] shadow">
          <CardContent className="text-sm">
            <div className="font-semibold mb-1">Legend</div>
            {DISEASES.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="grow">{d.name}</span>
                <span className="text-muted-foreground">{countOf(d.label)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </Card>
    </div>
  )
}

export default DiseaseMap
