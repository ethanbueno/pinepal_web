import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { BadgeCheckIcon, ClockIcon, ImageOffIcon, Maximize2Icon, Trash2Icon } from "lucide-react"
import { getScan, verifyScan, deleteScan } from "../api/scans"
import { getProtocols } from "../api/protocols"
import { getMyFarmer } from "../api/farmers"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import ProtocolCard from "../components/ProtocolCard"
import BackButton from "../components/BackButton"
import ConfirmModal from "../components/ConfirmModal"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import ConfidenceBar from "../components/ConfidenceBar"
import SelectField from "../components/SelectField"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate, formatDateTime, formatPercent } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))

function Info({ label, children }) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

// Shown in place of the photo when there is none, or when it lives on another backend.
// A soft tint of the disease color instead of a solid block, so it reads as "no photo", not as the photo.
function PhotoFallback({ color, missing }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center"
      style={{ backgroundColor: color + "12" }}
    >
      <span
        className="flex size-10 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10"
        style={{ color }}
      >
        <ImageOffIcon className="size-5" />
      </span>
      <div className="text-sm font-medium">{missing ? "No photo" : "Photo not on this server"}</div>
      <p className="max-w-[18ch] text-xs leading-snug text-muted-foreground">
        {missing ? "This scan was saved without a picture." : "It was uploaded to another PinePal backend."}
      </p>
    </div>
  )
}

// Where the "back" button goes, based on the page the user came from.
function getBack(from, isFarmer) {
  if (isFarmer) return { to: "/my-scans", label: "Back to my scans" }
  if (from === "/") return { to: "/", label: "Back to dashboard" }
  if (from === "/map") return { to: "/map", label: "Back to map" }
  if (from?.startsWith("/farmers/")) return { to: from, label: "Back to farmer" }
  return { to: "/scans", label: "Back to history" }
}

function ScanDetail() {
  const { uuid } = useParams()
  const { user } = useAuth()
  const isFarmer = user.role === "farmer"
  const location = useLocation()
  const back = getBack(location.state?.from, isFarmer)
  const navigate = useNavigate()
  const notify = useToast()

  const [scan, setScan] = useState(null)
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [chosenLabel, setChosenLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // The photo is kept by the backend that received it; on another backend (the database is
  // shared) it can't load, so the placeholder shows instead of a broken image
  const [failedPhoto, setFailedPhoto] = useState(null) // the photo url that didn't load

  useEffect(() => {
    let ignore = false

    Promise.all([getScan(uuid), getProtocols(), isFarmer ? getMyFarmer(user) : null])
      .then(([scanData, protocolData, myFarm]) => {
        if (ignore) return
        // a farmer can only open their own scans
        if (isFarmer && (!myFarm || myFarm.farmer_id !== scanData.farmer_id)) {
          throw { response: { status: 404 } }
        }
        setScan(scanData)
        setProtocols(protocolData)
        setChosenLabel(scanData.predicted_label)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError(err.response?.status === 404 ? "Scan not found." : "Could not load this scan.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [uuid, isFarmer, user])

  const handleVerify = async () => {
    setSaving(true)
    try {
      const updated = await verifyScan(uuid, chosenLabel, user.full_name)
      setScan(updated)
      notify("Scan verified.")
    } catch (err) {
      console.error(err)
      notify("Could not save the verification.", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setShowDelete(false)
    setDeleting(true)
    try {
      await deleteScan(uuid)
      notify("Scan deleted.")
      navigate(back.to)
    } catch (err) {
      console.error(err)
      notify(err.response?.status === 403 ? "Only admins can delete scans." : "Could not delete the scan.", "error")
      setDeleting(false)
    }
  }

  if (loading) return <LoadingBlocks rows={3} height="h-48" label="Loading scan" />
  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <ErrorAlert className="">{error}</ErrorAlert>
        <BackButton to={back.to}>{back.label}</BackButton>
      </div>
    )
  }

  const finalLabel = scan.verified_label || scan.predicted_label
  const finalDisease = getDisease(finalLabel)
  const finalColor = finalDisease?.color || "#888888"
  const predictedDisease = getDisease(scan.predicted_label)
  const secondDisease = getDisease(scan.second_label)
  const photoFailed = Boolean(scan.image_url) && failedPhoto === scan.image_url
  const showPhoto = Boolean(scan.image_url) && !photoFailed
  const protocol = protocols.find((p) => p.label === finalLabel)

  return (
    <div>
      <div className="mb-4">
        <BackButton to={back.to}>{back.label}</BackButton>
      </div>
      <PageHeader
        title="Scan detail"
        description={`${scan.farm_name || scan.farmer_name} · ${formatDateTime(scan.scanned_at)}`}
        action={
          user.role === "admin" && (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={deleting}
              onClick={() => setShowDelete(true)}
            >
              <Trash2Icon />
              {deleting ? "Deleting..." : "Delete scan"}
            </Button>
          )
        }
      />

      {/* top row: a small square photo, the diagnosis (with verifying it) and where it was taken.
          Phones stack them; tablets put the photo beside the diagnosis with the map under both;
          wide screens fit all three in one row, and the map stretches to the row's height. */}
      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,380px)]">
        <Card className="relative aspect-square gap-0 self-start py-0">
          {showPhoto ? (
            <a
              href={scan.image_url}
              target="_blank"
              rel="noreferrer"
              className="group absolute inset-0"
              title="Open the full-size photo"
            >
              <img
                src={scan.image_url}
                alt="Pineapple scan"
                onError={() => setFailedPhoto(scan.image_url)}
                className="size-full object-cover"
              />
              <span className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2Icon className="size-3.5" />
              </span>
            </a>
          ) : (
            <PhotoFallback color={finalColor} missing={!scan.image_url} />
          )}
        </Card>

        <Card className="gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="font-semibold">Diagnosis</CardTitle>
            <CardAction>
              {scan.verified_label ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-chart-2">
                  <BadgeCheckIcon className="size-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  Not verified yet
                </span>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {scan.verified_label ? "Verified as" : "Predicted condition"}
                </div>
                <div className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: finalColor }} />
                  <span className="truncate">{finalDisease?.name || finalLabel}</span>
                </div>
              </div>
              {!scan.verified_label && (
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-semibold tabular-nums tracking-tight">
                    {formatPercent(scan.confidence, 1)}
                  </div>
                  <div className="text-xs text-muted-foreground">confidence</div>
                </div>
              )}
            </div>

            {!scan.verified_label && (
              <div className="mt-3">
                <ConfidenceBar value={scan.confidence} />
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {scan.verified_label && (
                <span>
                  AI prediction:{" "}
                  <span className="font-medium text-foreground">{predictedDisease?.name || scan.predicted_label}</span>{" "}
                  ({formatPercent(scan.confidence, 1)})
                </span>
              )}
              <span>
                Second guess:{" "}
                <span className="font-medium text-foreground">{secondDisease?.name || scan.second_label}</span> (
                {formatPercent(scan.second_confidence, 1)})
              </span>
            </div>

            {/* verifying sits at the bottom of the same card, so the whole decision is in one place */}
            <div className="mt-auto pt-4">
              <div className="border-t pt-3">
                {scan.verified_label ? (
                  <p className="text-sm text-muted-foreground">
                    Verified by <span className="font-medium text-foreground">{scan.verified_by}</span>
                    {scan.verified_at && <> on {formatDateTime(scan.verified_at)}</>}
                    {scan.verified_label !== scan.predicted_label && (
                      <span className="font-semibold text-destructive"> · Corrected</span>
                    )}
                  </p>
                ) : isFarmer ? (
                  <p className="text-sm text-muted-foreground">An officer hasn't checked this scan yet.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Label className="text-muted-foreground">Correct disease</Label>
                    <SelectField
                      className="w-full sm:w-48"
                      value={chosenLabel}
                      onChange={setChosenLabel}
                      options={diseaseOptions}
                    />
                    <Button disabled={saving} onClick={handleVerify}>
                      {saving ? "Saving..." : "Verify"}
                    </Button>
                    {chosenLabel !== scan.predicted_label && (
                      <span className="text-sm font-semibold text-destructive">Corrected</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="h-56 sm:col-span-2 xl:col-span-1 xl:h-auto xl:min-h-[240px]">
          <MiniMap
            height="100%"
            center={[scan.latitude, scan.longitude]}
            zoom={13}
            points={[
              {
                id: scan.scan_uuid,
                lat: scan.latitude,
                lng: scan.longitude,
                color: finalColor,
                text: finalDisease?.name || finalLabel,
              },
            ]}
          />
        </div>
      </div>

      {/* the scan's facts in one compact strip instead of a tall two-column list */}
      <Card className="mt-4 gap-3">
        <CardHeader>
          <CardTitle className="font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <Info label="Farmer">{scan.farmer_name}</Info>
            <Info label="Farm">{scan.farm_name || "–"}</Info>
            <Info label="Municipality">{scan.municipality}</Info>
            <Info label="Source">{scan.image_source}</Info>
            <Info label="Scanned">{formatDateTime(scan.scanned_at)}</Info>
            <Info label="Synced">{formatDateTime(scan.synced_at)}</Info>
          </div>
          {scan.notes && (
            <div className="mt-3 border-t pt-3">
              <Info label="Notes">{scan.notes}</Info>
            </div>
          )}
        </CardContent>
      </Card>

      {/* the care guide is long, so it gets the whole width under both columns */}
      <div className="mt-4">
        <ProtocolCard protocol={protocol} wide />
      </div>

      <ConfirmModal
        open={showDelete}
        title="Delete scan?"
        message={`Are you sure you want to delete the ${formatDate(scan.scanned_at)} scan from ${scan.farm_name || scan.farmer_name}? This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}

export default ScanDetail
