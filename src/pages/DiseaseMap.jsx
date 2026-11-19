import { useEffect, useMemo, useState } from "react"
import DatePicker from "../components/DatePicker"
import MultiSelectField from "../components/MultiSelectField"
import { Link } from "react-router-dom"
import L from "leaflet"
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet"
import { getMapScans } from "../api/scans"
import { cachedGet } from "../api/cache"
import { DISEASES, FOUND_DISEASES, LOCKED_MUNICIPALITY, MUNICIPALITIES, getDisease } from "../utils/diseases"
import { viewBounds, viewMaxBounds } from "../utils/mapArea"
import IsabelaLayer from "../components/IsabelaLayer"
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

// The heat scale: the share of diseased scans around a scan, in fixed 10% bands from green (all
// healthy) through yellow and orange to red (all diseased). Fixed, so a color always means the
// same thing, whatever the zoom, filters or dates. Same bands on the mobile app.
const RATE_STOPS = ["#16A34A", "#84CC16", "#EAB308", "#F97316", "#DC2626"]

function mix(t) {
  const x = Math.min(Math.max(t, 0), 1) * (RATE_STOPS.length - 1)
  const i = Math.min(Math.floor(x), RATE_STOPS.length - 2)
  const f = x - i
  const a = RATE_STOPS[i].match(/\w\w/g).map((h) => parseInt(h, 16))
  const b = RATE_STOPS[i + 1].match(/\w\w/g).map((h) => parseInt(h, 16))
  return "#" + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, "0")).join("")
}

// band 0 = under 10% diseased ... band 9 = 90% and over
const RATE_BANDS = Array.from({ length: 10 }, (_, i) => mix((i + 0.5) / 10))
const rateColor = (rate) => RATE_BANDS[Math.min(9, Math.floor(rate * 10))]

// A scan's glow takes its color from the scans around it: those whose dots are within this
// distance on screen (so zoomed out it shows the area, zoomed in the spot)
const NEARBY_PIXELS = 45

// One scan on the map: its photo, diagnosis, confidence, date and farmer, and a link to it
function ScanPopup({ scan, disease }) {
  return (
    <div className="w-44">
      <img src={scanImage(scan)} alt="Scan" className="mb-2 aspect-square w-full rounded-md object-cover" />
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
  )
}

// The heat map: every scan with a disease is its own dot (in its disease color) with a soft glow
// under it. "No Disease" scans aren't drawn, but they still count in the glows: a glow is colored
// by the share of diseased scans around it (fixed 10% bands, green to red), so a lone case among
// healthy fruit glows green-yellow and a cluster of cases glows red. Overlapping glows add up, so
// busy diseased areas glow strongest. Each dot opens that scan.
function HeatDots({ scans, finalLabel }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  const points = useMemo(() => {
    const projected = scans.map((scan) => ({
      scan,
      p: map.project([scan.latitude, scan.longitude], zoom),
      diseased: finalLabel(scan) !== "No_Disease",
    }))
    // healthy scans count towards the share nearby, but only diseased ones get a dot and a glow
    return projected
      .filter((o) => o.diseased)
      .map(({ scan, p }) => {
        const near = projected.filter((o) => Math.hypot(o.p.x - p.x, o.p.y - p.y) < NEARBY_PIXELS)
        return {
          scan,
          glow: rateColor(near.filter((o) => o.diseased).length / near.length),
          dot: getDisease(finalLabel(scan)).color,
        }
      })
  }, [scans, zoom, map, finalLabel])

  return (
    <>
      {/* the glows: under every dot and not clickable */}
      {points.map(({ scan, glow }) => (
        <Marker
          key={"glow-" + scan.scan_uuid}
          position={[scan.latitude, scan.longitude]}
          interactive={false}
          keyboard={false}
          zIndexOffset={-1000}
          icon={L.divIcon({
            className: "",
            iconSize: [90, 90],
            html: `<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle, ${glow}38 0%, ${glow}1f 25%, ${glow}0b 50%, ${glow}00 70%)"></div>`,
          })}
        />
      ))}
      {points.map(({ scan, dot }) => (
        <Marker
          key={scan.scan_uuid}
          position={[scan.latitude, scan.longitude]}
          icon={L.divIcon({
            className: "",
            iconSize: [12, 12],
            html: `<div style="width:100%;height:100%;border-radius:50%;background:${dot};border:1px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.3)"></div>`,
          })}
        >
          <Popup>
            <ScanPopup scan={scan} disease={getDisease(finalLabel(scan))} />
          </Popup>
        </Marker>
      ))}
    </>
  )
}

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
            : "Every scan with a disease is a dot; the glow around it goes from green to red the more scans nearby have a disease. Healthy scans aren't shown here. Click a dot to open the scan.") +
          (LOCKED_MUNICIPALITY ? ` Temporarily locked to ${LOCKED_MUNICIPALITY}.` : "")
        }
      />

      {/* every filter on one row (wraps on phones) */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 sm:gap-4">
          <div className="flex w-[calc(50%-0.375rem)] flex-col gap-1.5 sm:w-36">
            <Label className="text-muted-foreground">Show as</Label>
            <SelectField
              value={view}
              onChange={(next) => {
                setView(next)
                // the heat map has no "No Disease" filter, so a leftover one would empty the map
                if (next === "heat") setSelected((current) => current.filter((label) => label !== "No_Disease"))
              }}
              options={VIEWS}
            />
          </div>
          <div className="flex w-[calc(50%-0.375rem)] flex-col gap-1.5 sm:w-52">
            <Label className="text-muted-foreground">Diseases</Label>
            <MultiSelectField
              value={selected}
              onChange={setSelected}
              allLabel="All Diseases"
              options={(view === "heat" ? FOUND_DISEASES : DISEASES).map((d) => ({
                value: d.label,
                label: d.name,
                color: d.color,
              }))}
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
          {view === "heat" && <HeatDots scans={scans} finalLabel={finalLabel} />}
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
                    <ScanPopup scan={scan} disease={disease} />
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
                <div className="text-xs font-medium">Glow: scans with a disease nearby</div>
                {/* the 10% bands, the same as on the map */}
                <div className="flex w-44 overflow-hidden rounded-sm">
                  {RATE_BANDS.map((color) => (
                    <span key={color} className="h-2.5 flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="flex w-44 justify-between text-xs text-muted-foreground tabular-nums">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <div className="text-xs text-muted-foreground">Dots: each scan with a disease, in its color</div>
              </div>
            )}
            {(view === "heat" ? FOUND_DISEASES : DISEASES).map((d) => (
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
