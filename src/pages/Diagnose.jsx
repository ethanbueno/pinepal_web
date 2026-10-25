import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlusIcon, XIcon } from "lucide-react"
import { diagnoseImage } from "../api/diagnose"
import { getFarmers } from "../api/farmers"
import { createScan } from "../api/scans"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ProtocolCard from "../components/ProtocolCard"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import SelectField from "../components/SelectField"
import { getDisease } from "../utils/diseases"
import { formatPercent } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// like the mobile app: 87.3%
const percent = (value) => formatPercent(value, 1)

// Same flow as the mobile app: photo on top, a sheet below it.
// Choose a photo -> "Analyze Photo" -> disease, confidence and the top 3 guesses.
function Diagnose() {
  const navigate = useNavigate()
  const notify = useToast()

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [dragging, setDragging] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

  // save as scan
  const [showSave, setShowSave] = useState(false)
  const [farmers, setFarmers] = useState([])
  const [farmerId, setFarmerId] = useState("")
  const [location, setLocation] = useState(null) // { lat, lng }
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getFarmers({ status: "active" })
      .then(setFarmers)
      .catch((err) => console.error(err))
  }, [])

  const chooseFile = (chosen) => {
    setError("")
    setResult(null)
    setShowSave(false)

    if (!chosen) return
    if (chosen.type !== "image/jpeg" && chosen.type !== "image/png") {
      setError("File must be JPG or PNG.")
      return
    }
    if (chosen.size > MAX_SIZE) {
      setError("The image is larger than 5 MB.")
      return
    }

    setFile(chosen)
    setPreview(URL.createObjectURL(chosen))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    chooseFile(e.dataTransfer.files[0])
  }

  const handleDiagnose = async () => {
    setDiagnosing(true)
    setError("")
    try {
      const data = await diagnoseImage(file)
      setResult(data)
    } catch (err) {
      console.error(err)
      if (err.response) {
        setError(err.response.data?.error || "Could not diagnose the image.")
      } else {
        setError("Cannot reach the server. Is the Flask backend running?")
      }
    } finally {
      setDiagnosing(false)
    }
  }

  // choosing a farmer moves the pin to that farm
  const handleFarmerChange = (id) => {
    setFarmerId(id)
    const farmer = farmers.find((f) => f.farmer_id === id)
    setLocation(farmer ? { lat: farmer.farm_latitude, lng: farmer.farm_longitude } : null)
  }

  const handleSave = async () => {
    const farmer = farmers.find((f) => f.farmer_id === farmerId)
    const top = result.predictions[0]
    const second = result.predictions[1]

    setSaving(true)
    try {
      const saved = await createScan({
        farmer_id: farmer.farmer_id,
        farmer_name: farmer.full_name,
        farm_name: farmer.farm_name,
        municipality: farmer.municipality,
        latitude: location.lat,
        longitude: location.lng,
        predicted_label: top.label,
        confidence: top.confidence,
        second_label: second.label,
        second_confidence: second.confidence,
        image_source: "Web",
        image_url: preview,
        notes: notes || null,
      })
      notify("Scan saved.")
      navigate("/scans/" + saved.scan_uuid)
    } catch (err) {
      console.error(err)
      notify("Could not save the scan.", "error")
      setSaving(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview("")
    setResult(null)
    setError("")
    setShowSave(false)
    setFarmerId("")
    setLocation(null)
    setNotes("")
  }

  const top = result ? result.predictions[0] : null
  const topDisease = top ? getDisease(top.label) : null
  const farmerOptions = farmers.map((f) => ({ value: f.farmer_id, label: `${f.full_name} - ${f.farm_name}` }))

  return (
    <div>
      <h1 className="text-2xl font-medium">Scan Pineapple</h1>
      <p className="text-muted-foreground mb-4">Upload a photo of the fruit to check for disease.</p>

      <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
      {/* step 1: no photo yet */}
      {!preview && (
        <>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center p-10 text-center cursor-pointer min-h-96",
              "rounded-xl bg-card ring-1 ring-foreground/10 border-2 border-dashed border-border transition-colors",
              dragging && "border-primary"
            )}
          >
            <img src={logo} alt="" className="mb-3 size-24" />
            <div className="font-semibold">Drag a photo here</div>
            <div className="text-sm text-muted-foreground mb-4">JPG or PNG, up to 5 MB</div>
            <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium h-9 px-4 rounded-lg">
              <ImagePlusIcon className="size-4" />
              Choose from Gallery
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => chooseFile(e.target.files[0])}
            />
          </label>
          {error && <ErrorAlert className="mt-4">{error}</ErrorAlert>}
        </>
      )}

      {/* step 2 and 3: photo on top, sheet below */}
      {preview && (
        <Card className="py-0">
          <div className="relative bg-black">
            <img src={preview} alt="Pineapple" className="w-full max-h-[28rem] object-contain" />
            <Button
              type="button"
              size="icon-lg"
              onClick={reset}
              aria-label="Close photo"
              className="absolute top-3 left-3 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <XIcon />
            </Button>
          </div>

          <CardContent className="p-5">
            {!result ? (
              <>
                <div className="text-xl font-semibold">Photo ready</div>
                <div className="text-sm text-muted-foreground mb-4">Source: Web upload</div>

                {error && <ErrorAlert>{error}</ErrorAlert>}

                <Button size="lg" className="w-full h-11" disabled={diagnosing} onClick={handleDiagnose}>
                  {diagnosing ? "Analyzing..." : "Analyze Photo"}
                </Button>
                <Button variant="outline" size="lg" className="w-full h-11 mt-2" onClick={reset}>
                  Choose another
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xl font-semibold">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: topDisease.color }}
                  />
                  {topDisease.name}
                </div>
                <div className="text-sm text-muted-foreground">Confidence: {percent(top.confidence)}</div>

                {result.low_confidence && (
                  <p className="mt-3 rounded-lg border border-destructive bg-muted px-3 py-2 text-sm">
                    ⚠ Not sure, please retake the photo.
                  </p>
                )}

                <div className="text-sm text-muted-foreground mt-4 mb-1">Top 3 guesses</div>
                {result.predictions.map((p) => (
                  <div key={p.label} className="flex justify-between py-1 text-sm">
                    <span>{getDisease(p.label).name}</span>
                    <span>{percent(p.confidence)}</span>
                  </div>
                ))}

                <Button variant="outline" size="lg" className="w-full h-11 mt-4" onClick={reset}>
                  Scan another
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      </div>

      {/* right column: the result details, guide and the optional save */}
      {result ? (
        <div className="flex flex-col gap-4">
          <ProtocolCard protocol={result.protocol} />

          {!showSave ? (
            <Button variant="outline" size="lg" className="w-full h-11" onClick={() => setShowSave(true)}>
              Save as scan
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Save as scan</CardTitle>
              </CardHeader>
              <CardContent>
                <Label className="mb-1.5">Farmer</Label>
                <div className="mb-3">
                  <SelectField
                    value={farmerId}
                    onChange={handleFarmerChange}
                    options={farmerOptions}
                    placeholder={farmers.length === 0 ? "No farmers yet" : "Choose a farmer"}
                  />
                </div>

                <Label className="mb-1.5">Location (click the map to move the pin)</Label>
                <div className="mb-3">
                  <MiniMap
                    height={220}
                    center={location ? [location.lat, location.lng] : undefined}
                    zoom={location ? 12 : undefined}
                    onPick={(lat, lng) => setLocation({ lat, lng })}
                    points={
                      location
                        ? [{ id: "pin", lat: location.lat, lng: location.lng, color: topDisease.color }]
                        : []
                    }
                  />
                </div>

                <Label className="mb-1.5">Notes</Label>
                <Textarea className="mb-3" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

                <Button
                  size="lg"
                  className="w-full h-11"
                  disabled={!farmerId || saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving..." : "Save scan"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            The remediation guide and save options will appear here after the photo is analyzed.
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}

export default Diagnose
