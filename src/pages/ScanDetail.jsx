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
import { Card, CardContent } from "@/components/ui/card"

const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))

// one label / value row of the scan's facts
function Info({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
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
  if (isFarmer) return { to: "/my-scans", label: "Back to My Scans" }
  if (from === "/") return { to: "/", label: "Back to Dashboard" }
  if (from === "/map") return { to: "/map", label: "Back to Map" }
  if (from?.startsWith("/farmers/")) return { to: from, label: "Back to Farmer" }
  return { to: "/scans", label: "Back to History" }
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
        title="Scan Detail"
        description={`${scan.farm_name || scan.farmer_name} · ${formatDateTime(scan.scanned_at)}`}
      />

      {/* Big screens: two columns. On the left, a large photo and map;
          on the right, the diagnosis with verifying, the scan's details, then the care
          guide. Phones and tablets stack them. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="relative aspect-square gap-0 overflow-hidden py-0">
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

          <div className="aspect-square sm:aspect-auto sm:h-full xl:aspect-auto xl:h-[19rem]">
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

        <div className="flex min-w-0 flex-col gap-4">
          {/* the diagnosis, compact: the condition and confidence on one line with a thin bar,
              then the second guess and verifying on one row where there is room */}
          <Card className="gap-0 py-3">
            <CardContent className="flex flex-col gap-2.5 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: finalColor }} />
                  <span className="truncate text-lg font-semibold tracking-tight">
                    {finalDisease?.name || finalLabel}
                  </span>
                  {scan.verified_label ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-chart-2">
                      <BadgeCheckIcon className="size-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="size-3.5" />
                      Not Verified
                    </span>
                  )}
                </div>
                {!scan.verified_label && (
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold">{formatPercent(scan.confidence, 1)}</span>
                    <span className="text-muted-foreground"> confidence</span>
                  </span>
                )}
              </div>

              {!scan.verified_label && <ConfidenceBar value={scan.confidence} thin />}

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {scan.verified_label && (
                    <span>
                      Predicted:{" "}
                      <span className="font-medium text-foreground">
                        {predictedDisease?.name || scan.predicted_label}
                      </span>{" "}
                      ({formatPercent(scan.confidence, 1)})
                    </span>
                  )}
                  <span>
                    Second guess:{" "}
                    <span className="font-medium text-foreground">{secondDisease?.name || scan.second_label}</span> (
                    {formatPercent(scan.second_confidence, 1)})
                  </span>
                </div>

                {scan.verified_label ? (
                  <span>
                    By <span className="font-medium text-foreground">{scan.verified_by}</span>
                    {scan.verified_at && <> · {formatDateTime(scan.verified_at)}</>}
                    {scan.verified_label !== scan.predicted_label && (
                      <span className="font-semibold text-destructive"> · Corrected</span>
                    )}
                  </span>
                ) : isFarmer ? (
                  <span>An officer hasn&apos;t checked this scan yet.</span>
                ) : (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <SelectField
                      className="min-w-0 flex-1 sm:w-44 sm:flex-none"
                      value={chosenLabel}
                      onChange={setChosenLabel}
                      options={diseaseOptions}
                    />
                    <Button size="sm" disabled={saving} onClick={handleVerify}>
                      {saving ? "Saving..." : chosenLabel !== scan.predicted_label ? "Correct" : "Verify"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-1">
            {/* the scan's facts as label / value rows, two columns where there is room */}
            <dl className="grid px-4 text-sm sm:grid-cols-2 sm:gap-x-8">
              <Info label="Farmer">{scan.farmer_name}</Info>
              <Info label="Farm">{scan.farm_name || "–"}</Info>
              <Info label="Municipality">{scan.municipality}</Info>
              <Info label="Source">{scan.image_source}</Info>
              <Info label="Scanned">{formatDateTime(scan.scanned_at)}</Info>
              <Info label="Synced">{formatDateTime(scan.synced_at)}</Info>
              <Info label="Location">
                {scan.latitude.toFixed(5)}, {scan.longitude.toFixed(5)}
              </Info>
            </dl>
            {scan.notes && (
              <div className="border-t px-4 py-3 text-sm">
                <div className="mb-1 text-muted-foreground">Notes</div>
                <p className="whitespace-pre-line">{scan.notes}</p>
              </div>
            )}
          </Card>

          {/* the care guide for the final diagnosis */}
          <ProtocolCard protocol={protocol} />
        </div>
      </div>

      {/* deleting is rare and can't be undone, so it sits at the very bottom */}
      {user.role === "admin" && (
        <div className="mt-6 flex justify-end border-t pt-4">
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleting}
            onClick={() => setShowDelete(true)}
          >
            <Trash2Icon />
            {deleting ? "Deleting..." : "Delete Scan"}
          </Button>
        </div>
      )}

      <ConfirmModal
        open={showDelete}
        title="Delete Scan?"
        message={`Are you sure you want to delete the ${formatDate(scan.scanned_at)} scan from ${scan.farm_name || scan.farmer_name}? This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}

export default ScanDetail
