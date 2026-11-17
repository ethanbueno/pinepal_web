import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlusIcon, XIcon, TriangleAlertIcon, ImageOffIcon, ClipboardListIcon } from "lucide-react"
import { diagnoseImage } from "../api/diagnose"
import { getFarmers, getMyFarmer } from "../api/farmers"
import { createScan, uploadMyScan } from "../api/scans"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ProtocolCard from "../components/ProtocolCard"
import PinePalLoader from "../components/PinePalLoader"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import EmptyState from "../components/EmptyState"
import SelectField from "../components/SelectField"
import { getDisease } from "../utils/diseases"
import { OUTSIDE_TOWN, insideLockedTown } from "../utils/mapArea"
import { startingGuides } from "../utils/guides"
import { formatPercent } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// every scan saved from this page goes under Echague (same as the mobile app)
const SCAN_MUNICIPALITY = "Echague"

// like the mobile app: 87.3%
const percent = (value) => formatPercent(value, 1)

// the farm's pin, or null when the farm has no location yet
const farmPin = (farm) =>
  farm?.farm_latitude != null ? { lat: farm.farm_latitude, lng: farm.farm_longitude } : null

// local time without a zone, like the mobile app sends: 2026-11-04T09:30:00
function localTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

// crypto.randomUUID only exists on https or localhost, so build one by hand otherwise
function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Same flow as the mobile app: photo on top, a sheet below it.
// Choose a photo -> "Analyze Photo" -> disease, confidence and the top 3 guesses.
// A photo the model says is not a pineapple gets a retake message and can't be saved.
// Staff save a scan for any farmer. A farmer saves to their own history, with the photo.
function Diagnose() {
  const navigate = useNavigate()
  const notify = useToast()
  const { user } = useAuth()
  const isFarmer = user.role === "farmer"

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
  const [myFarm, setMyFarm] = useState(null) // farmers only
  const [location, setLocation] = useState(null) // { lat, lng }
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isFarmer) {
      // the pin starts on the farmer's own farm
      getMyFarmer()
        .then((farm) => {
          setMyFarm(farm)
          setLocation(farmPin(farm))
        })
        .catch((err) => console.error(err))
      return
    }
    getFarmers({ status: "active" })
      .then(setFarmers)
      .catch((err) => console.error(err))
  }, [isFarmer])

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

  // choosing a farmer moves the pin to that farm; "no farmer" keeps the pin where it is
  const handleFarmerChange = (id) => {
    setFarmerId(id)
    const farmer = farmers.find((f) => f.farmer_id === id)
    if (farmer?.farm_latitude != null) setLocation({ lat: farmer.farm_latitude, lng: farmer.farm_longitude })
  }

  const handleSave = async () => {
    const farmer = farmers.find((f) => f.farmer_id === farmerId)
    const top = result.predictions[0]
    const second = result.predictions[1]

    setSaving(true)
    if (isFarmer) {
      try {
        const saved = await uploadMyScan(file, {
          scan_uuid: newUuid(),
          farm_name: myFarm?.farm_name || null,
          municipality: SCAN_MUNICIPALITY,
          latitude: location.lat,
          longitude: location.lng,
          scanned_at: localTimestamp(),
          predicted_label: top.label,
          confidence: top.confidence,
          second_label: second?.label,
          second_confidence: second?.confidence,
          notes: notes || null,
        })
        notify("Scan saved to My Scans.")
        navigate("/scans/" + saved.scan_uuid)
      } catch (err) {
        console.error(err)
        notify(err.response?.data?.error || "Could not save the scan.", "error")
        setSaving(false)
      }
      return
    }

    try {
      // no farmer chosen: the server saves it under the signed-in staff account
      const saved = await createScan({
        ...(farmer ? { farmer_id: farmer.farmer_id, farm_name: farmer.farm_name } : {}),
        municipality: SCAN_MUNICIPALITY,
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
      notify(farmer ? "Scan saved." : "Scan saved under your account.")
      navigate("/scans/" + saved.scan_uuid)
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || "Could not save the scan.", "error")
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
    setLocation(isFarmer ? farmPin(myFarm) : null)
    setNotes("")
  }

  // is_pineapple is missing only with an older backend, which had no pineapple check
  const notPineapple = result?.is_pineapple === false
  const uncertain = result ? (result.uncertain ?? result.low_confidence) : false
  const top = result?.predictions?.[0] ?? null
  const topDisease = top ? getDisease(top.label) : null
  // the pin must be inside Echague to save (the server checks it too)
  const locationOutside = Boolean(location) && !insideLockedTown(location.lat, location.lng)
  const farmerOptions = farmers.map((f) => ({ value: f.farmer_id, label: `${f.full_name} - ${f.farm_name}` }))

  return (
    <div>
      <PageHeader title="Scan Pineapple" description="Upload a photo of the fruit to check for disease." />

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
              "flex min-h-80 cursor-pointer flex-col items-center justify-center p-8 text-center",
              "rounded-xl border-2 border-dashed border-border bg-card transition-colors hover:border-primary/60",
              "focus-within:ring-2 focus-within:ring-ring",
              dragging && "border-primary bg-primary/5"
            )}
          >
            <img src={logo} alt="" className="mb-3 size-24" />
            <div className="font-semibold">Drag a photo here</div>
            <div className="mb-5 text-sm text-muted-foreground">JPG or PNG, up to 5 MB</div>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              <ImagePlusIcon className="size-4" />
              Choose from Gallery
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => chooseFile(e.target.files[0])}
            />
          </label>
          {error && <ErrorAlert className="">{error}</ErrorAlert>}
        </>
      )}

      {/* step 2 and 3: photo on top, sheet below */}
      {preview && (
        <Card className="py-0">
          <div className="relative bg-black">
            <img src={preview} alt="Pineapple" className="max-h-[28rem] w-full object-contain" />
            {/* while the photo is being analyzed, the loader sits over it */}
            {diagnosing && (
              <div aria-busy="true" className="absolute inset-0 flex items-center justify-center bg-black/45">
                <PinePalLoader size={88} label="Analyzing photo" onDark />
              </div>
            )}
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
            {result && notPineapple ? (
              <>
                <div className="text-xl font-semibold tracking-tight">This doesn't look like a pineapple</div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Pick a photo that clearly shows the pineapple fruit, crown or leaves, in good light. This photo
                  was not checked for disease and can't be saved as a scan.
                </p>
                {/* opens the file picker straight away; the new photo replaces this one */}
                <label className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground">
                  <ImagePlusIcon className="size-4" />
                  Choose another photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => chooseFile(e.target.files[0])}
                  />
                </label>
                <Button variant="outline" size="lg" className="mt-2 h-10 w-full" onClick={reset}>
                  Cancel
                </Button>
              </>
            ) : !result ? (
              <>
                <div className="text-xl font-semibold tracking-tight">Photo ready</div>
                <div className="mb-4 text-sm text-muted-foreground">Source: Web upload</div>

                {error && <ErrorAlert>{error}</ErrorAlert>}

                <Button size="lg" className="h-10 w-full" disabled={diagnosing} onClick={handleDiagnose}>
                  {diagnosing ? "Analyzing..." : "Analyze Photo"}
                </Button>
                <Button variant="outline" size="lg" className="mt-2 h-10 w-full" onClick={reset}>
                  Choose another
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <span className="size-3 rounded-full" style={{ backgroundColor: topDisease.color }} />
                  {topDisease.name}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">Confidence: {percent(top.confidence)}</div>

                {uncertain && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    Not sure, please retake the photo.
                  </p>
                )}

                <div className="mt-5 mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Top 3 guesses
                </div>
                <div className="divide-y">
                  {result.predictions.map((p) => (
                    <div key={p.label} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: getDisease(p.label).color }} />
                        {getDisease(p.label).name}
                      </span>
                      <span className="font-medium tabular-nums">{percent(p.confidence)}</span>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="lg" className="mt-4 h-10 w-full" onClick={reset}>
                  Scan another
                </Button>
                {!showSave && (
                  <Button size="lg" className="mt-2 h-10 w-full" onClick={() => setShowSave(true)}>
                    Save as scan
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* the save form opens under the result, in the same column as its button */}
      {result && !notPineapple && showSave && (
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Save as scan</CardTitle>
          </CardHeader>
          <CardContent>
            {isFarmer ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  {myFarm?.farm_name
                    ? `Saved to your scans for ${myFarm.farm_name}.`
                    : "Your farm has no details yet. Click the map where your farm is, and it is saved as your farm's location."}
                </p>
              </>
            ) : (
              <>
                <Label className="mb-1.5 text-muted-foreground">Farmer (optional)</Label>
                <div className="mb-1.5">
                  {/* empty = no farmer: the scan is saved under the signed-in staff account */}
                  <SelectField
                    value={farmerId}
                    onChange={handleFarmerChange}
                    options={farmerOptions}
                    allLabel="No farmer (save under my account)"
                  />
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {farmerId
                    ? "The pin starts on this farmer's farm."
                    : `Saved as yours (${user.full_name}). Click the map to place the pin.`}
                </p>
              </>
      )}

          <Label className="mb-1.5 text-muted-foreground">Location (click the map to move the pin)</Label>
          <div className="mb-3">
            {/* tall enough to pan and zoom comfortably; scales with the window, 360-480px */}
            <MiniMap
              height="clamp(360px, 55vh, 480px)"
              center={location ? [location.lat, location.lng] : undefined}
              zoom={location ? 12 : undefined}
              onPick={(lat, lng) => {
                // a pin outside Echague is refused right away
                if (!insideLockedTown(lat, lng)) {
                  notify(OUTSIDE_TOWN, "error")
                  return
                }
                setLocation({ lat, lng })
              }}
              points={
                location
                  ? [{ id: "pin", lat: location.lat, lng: location.lng, color: topDisease.color }]
                  : []
              }
            />
          </div>
          {/* a farm pin saved before the Echague lock can still be outside it */}
          {locationOutside && (
            <p className="-mt-1 mb-3 text-sm text-destructive">
              This pin is outside Echague. Click the map inside the Echague border to move it before saving.
            </p>
          )}

          <Label className="mb-1.5 text-muted-foreground">Notes</Label>
          <Textarea className="mb-4" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <Button
            size="lg"
            className="h-10 w-full"
            disabled={!location || locationOutside || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : isFarmer ? "Save to My Scans" : "Save scan"}
          </Button>
        </CardContent>
      </Card>
      )}

      </div>

      {/* right column: the remediation guide for the result */}
      {result && notPineapple ? (
        <EmptyState icon={ImageOffIcon} title="No diagnosis" text="No diagnosis for this photo. Try another photo of the pineapple." />
      ) : result ? (
        <div className="flex flex-col gap-4">
          {/* the server has no guides yet, so use the same guide as the mobile app */}
          <ProtocolCard protocol={result.protocol ?? startingGuides.find((g) => g.label === top?.label)} />
        </div>
      ) : (
        <EmptyState
          icon={ClipboardListIcon}
          title="Nothing analyzed yet"
          text="The remediation guide and save options will appear here after the photo is analyzed."
        />
      )}
      </div>
    </div>
  )
}

export default Diagnose
