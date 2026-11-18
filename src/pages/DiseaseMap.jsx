import { useEffect, useMemo, useState } from "react"
import DatePicker from "../components/DatePicker"
import MultiSelectField from "../components/MultiSelectField"
import { Link } from "react-router-dom"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import { getMapScans } from "../api/scans"
import { cachedGet } from "../api/cache"
import { DISEASES, LOCKED_MUNICIPALITY, MUNICIPALITIES, getDisease } from "../utils/diseases"
import { viewBounds, viewMaxBounds } from "../utils/mapArea"
import IsabelaLayer from "../components/IsabelaLayer"
import HeatLayer from "../components/HeatLayer"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import SelectField, { toOptions } from "../components/SelectField"
import { formatDate, formatPercent, scanImage } from "../utils/format"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import PinePalLoader from "../components/PinePalLoader"

// How the scans are drawn: a heat map of where disease is, or a dot per scan, colored by disease
const VIEWS = [
  { value: "heat", label: "Heat Map" },
  { value: "dots", label: "Dots" },
]

// A heat map color scale, from few diseased scans to many
const HEAT_SCALE = "linear-gradient(to right, #2563EB, #16A34A, #EAB308, #F97316, #DC2626)"

function DiseaseMap() {
  const [view, setView] = useState("heat") // opens on the heat map; Dots shows each scan
  const [selected, setSelected] = useState([]) // empty = show all diseases
  const [municipality, setMunicipality] = useState(LOCKED_MUNICIPALITY)
  const [range, setRange] = useState({ from: "", to: "" })
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false

    const params = { diseases: selected, municipality, ...range }
    cachedGet(["mapScans", params], () => getMapScans(params), (data) => {
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


  const finalLabel = (scan) => scan.verified_label || scan.predicted_label
  const countOf = (label) => scans.filter((s) => finalLabel(s) === label).length

  // The heat map is about disease, so healthy scans only count when No Disease is picked on its own
  const onlyHealthy = selected.length === 1 && selected[0] === "No_Disease"
  const heatPoints = useMemo(
    () => scans.filter((s) => onlyHealthy || finalLabel(s) !== "No_Disease").map((s) => [s.latitude, s.longitude]),
    [scans, onlyHealthy],
  )
  // Desktop: the page fills the window, 100dvh minus the layout's top padding (24px) and a bottom gap
  // equal to the side padding (40px), so the margins are even; the map keeps at least 420px.
  // Phones: the page scrolls normally and the map is 60% of the screen, so there is always some page
  // above or below it to scroll with (a full-screen map would catch every swipe).
  return (
    <div className="flex flex-col md:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Disease Map"
        description={
          (view === "dots"
            ? "Where each scan was taken, colored by diagnosis. Click a dot for details."
            : "Where disease is most common: the redder the area, the more diseased scans there.") +
          (LOCKED_MUNICIPALITY ? ` Temporarily locked to ${LOCKED_MUNICIPALITY}.` : "")
        }
      />

      {/* every filter on one row (wraps on phones) */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 sm:gap-4">
          <div className="flex w-[calc(50%-0.375rem)] flex-col gap-1.5 sm:w-36">
            <Label className="text-muted-foreground">Show as</Label>
            <SelectField value={view} onChange={setView} options={VIEWS} />
          </div>
          <div className="flex w-[calc(50%-0.375rem)] flex-col gap-1.5 sm:w-52">
            <Label className="text-muted-foreground">Diseases</Label>
            <MultiSelectField
              value={selected}
              onChange={setSelected}
              allLabel="All Diseases"
              options={DISEASES.map((d) => ({ value: d.label, label: d.name, color: d.color }))}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-40">
            <Label className="text-muted-foreground">Municipality</Label>
            <SelectField
              allLabel={LOCKED_MUNICIPALITY ? undefined : "All (Isabela)"}
              value={municipality}
              onChange={setMunicipality}
              options={toOptions(LOCKED_MUNICIPALITY ? [LOCKED_MUNICIPALITY] : MUNICIPALITIES)}
              disabled={Boolean(LOCKED_MUNICIPALITY)}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-40 sm:flex-none">
            <Label className="text-muted-foreground">From</Label>
            <DatePicker value={range.from} onChange={(value) => setRange({ ...range, from: value })} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-40 sm:flex-none">
            <Label className="text-muted-foreground">To</Label>
            <DatePicker value={range.to} onChange={(value) => setRange({ ...range, to: value })} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Card className="relative isolate z-0 h-[60dvh] min-h-80 grow py-0 md:h-auto md:min-h-[420px]">
        {loading && (
          <div
            aria-busy="true"
            className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-card/70 text-sm font-medium text-muted-foreground"
          >
            <PinePalLoader size={80} label="Loading map" />
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
          {view === "heat" && <HeatLayer points={heatPoints} />}
          {view === "dots" &&
            scans.map((scan) => {
              const disease = getDisease(finalLabel(scan))
              return (
                <CircleMarker
                  key={scan.scan_uuid}
                  center={[scan.latitude, scan.longitude]}
                  radius={8}
                  pathOptions={{
                    color: disease.color,
                    fillColor: disease.color,
                    fillOpacity: 0.7,
                  }}
                >
                  <Popup>
                    <div className="w-44">
                      <img
                        src={scanImage(scan)}
                        alt="Scan"
                        className="mb-2 aspect-square w-full rounded-md object-cover"
                      />
                      <div className="font-semibold">{disease.name}</div>
                      <div className="text-xs">Confidence: {formatPercent(scan.confidence)}</div>
                      <div className="text-xs">{formatDate(scan.scanned_at)}</div>
                      <div className="mb-1 text-xs">{scan.farmer_name}</div>
                      <Link
                        to={"/scans/" + scan.scan_uuid}
                        state={{ from: "/map" }}
                        className="text-xs font-semibold underline underline-offset-4"
                      >
                        View Details
                      </Link>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
        </MapContainer>

        <Card size="sm" className="absolute top-3 right-3 z-[1000] shadow-sm">
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="mb-1 font-semibold">Legend</div>
            {view === "heat" && (
              <div className="mb-2 flex flex-col gap-1">
                <div className="h-2 w-40 rounded-full" style={{ background: HEAT_SCALE }} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fewer</span>
                  <span>More {onlyHealthy ? "healthy" : "diseased"}</span>
                </div>
              </div>
            )}
            {DISEASES.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="grow">{d.name}</span>
                <span className="pl-2 font-medium tabular-nums">{countOf(d.label)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </Card>
    </div>
  )
}

export default DiseaseMap
